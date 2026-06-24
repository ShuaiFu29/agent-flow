import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import type { RunnerPreviewResponse, RunnerPreviewState } from "@agent-flow/shared";

type ManagedPreviewSession = {
  child?: ChildProcessWithoutNullStreams;
  preview: RunnerPreviewState;
  stdout: string;
  stderr: string;
};

type PreviewCommandPlan = {
  file: string;
  args: string[];
  command: string;
  env: NodeJS.ProcessEnv;
};

type PreviewManagerRuntime = {
  now: () => string;
  fetch: typeof globalThis.fetch;
  setTimeout: typeof globalThis.setTimeout;
  spawn: typeof spawn;
};

const DEFAULT_PREVIEW_TIMEOUT_MS = 15_000;
const PREVIEW_POLL_INTERVAL_MS = 250;

export function createPreviewProcessManager(
  runtimeOverrides: Partial<PreviewManagerRuntime> = {},
): {
  startPreview: (input: { workspaceRoot: string }) => Promise<RunnerPreviewResponse>;
  stopPreview: (input: { workspaceRoot: string }) => Promise<RunnerPreviewResponse>;
  restartPreview: (input: { workspaceRoot: string }) => Promise<RunnerPreviewResponse>;
  getPreviewState: (input: { workspaceRoot: string }) => Promise<RunnerPreviewResponse>;
  shutdown: () => Promise<void>;
} {
  const runtime: PreviewManagerRuntime = {
    now: () => new Date().toISOString(),
    fetch: globalThis.fetch,
    setTimeout: globalThis.setTimeout,
    spawn,
    ...runtimeOverrides,
  };
  const sessions = new Map<string, ManagedPreviewSession>();

  return {
    startPreview: async ({ workspaceRoot }) => {
      const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
      return await startInternal(normalizedWorkspaceRoot);
    },

    stopPreview: async ({ workspaceRoot }) => {
      const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
      const stoppedSession = await stopInternal(normalizedWorkspaceRoot, "Preview stopped.");

      if (!stoppedSession) {
        return {
          ok: false,
          message: "No preview session found for the workspace.",
        };
      }

      return {
        ok: true,
        message: "Preview stopped.",
        preview: stoppedSession.preview,
      };
    },

    restartPreview: async ({ workspaceRoot }) => {
      const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
      await stopInternal(normalizedWorkspaceRoot, "Preview restarted.");
      return await startInternal(normalizedWorkspaceRoot);
    },

    getPreviewState: async ({ workspaceRoot }) => {
      const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
      const session = sessions.get(normalizedWorkspaceRoot);

      if (!session) {
        return {
          ok: false,
          message: "No preview session found for the workspace.",
        };
      }

      return {
        ok: session.preview.status !== "failed",
        message:
          session.preview.status === "running"
            ? "Preview is running."
            : session.preview.status === "starting"
              ? "Preview is starting."
              : session.preview.status === "stopped"
                ? "Preview is stopped."
                : session.preview.failureMessage ?? "Preview failed.",
        preview: session.preview,
      };
    },

    shutdown: async () => {
      for (const workspaceRoot of Array.from(sessions.keys())) {
        await stopInternal(workspaceRoot, "Runner control server shutdown.");
      }
    },
  };

  async function startInternal(normalizedWorkspaceRoot: string): Promise<RunnerPreviewResponse> {
    const existingSession = sessions.get(normalizedWorkspaceRoot);

    if (existingSession?.preview.status === "starting" || existingSession?.preview.status === "running") {
      await stopInternal(normalizedWorkspaceRoot, "Preview restarted before relaunch.");
    }

    const port = await reservePort();
    const plan = await resolvePreviewCommand(normalizedWorkspaceRoot, port);
    if (!plan.ok) {
      const failedPreview: RunnerPreviewState = {
        status: "failed",
        url: `http://127.0.0.1:${port}`,
        port,
        command: plan.command,
        startedAt: runtime.now(),
        failureMessage: plan.message,
      };
      sessions.set(normalizedWorkspaceRoot, {
        preview: failedPreview,
        stdout: "",
        stderr: "",
      });

      return {
        ok: false,
        message: plan.message,
        preview: failedPreview,
      };
    }

    const startedAt = runtime.now();
    const preview: RunnerPreviewState = {
      status: "starting",
      url: `http://127.0.0.1:${port}`,
      port,
      command: plan.command,
      startedAt,
    };
    const child = runtime.spawn(plan.file, plan.args, {
      cwd: normalizedWorkspaceRoot,
      env: {
        ...process.env,
        ...plan.env,
      },
      shell: false,
      windowsHide: true,
    });
    const session: ManagedPreviewSession = {
      child,
      preview,
      stdout: "",
      stderr: "",
    };

    sessions.set(normalizedWorkspaceRoot, session);
    child.stdout.on("data", (chunk) => {
      session.stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      session.stderr += chunk.toString();
    });
    child.on("error", (error) => {
      session.preview = {
        ...session.preview,
        status: "failed",
        lastHeartbeatAt: runtime.now(),
        failureMessage: error.message,
      };
      session.child = undefined;
    });
    child.on("close", (code, signal) => {
      if (session.preview.status === "stopped") {
        session.child = undefined;
        return;
      }

      session.preview = {
        ...session.preview,
        status: "failed",
        lastHeartbeatAt: runtime.now(),
        failureMessage: `Preview process exited unexpectedly (${formatExit(code, signal)}).`,
      };
      session.child = undefined;
    });

    const healthy = await waitForPreviewHealth({
      fetchImpl: runtime.fetch,
      setTimeoutImpl: runtime.setTimeout,
      url: preview.url,
      timeoutMs: DEFAULT_PREVIEW_TIMEOUT_MS,
    });

    if (!healthy.ok) {
      await terminatePreviewProcess(child);
      session.preview = {
        ...session.preview,
        status: "failed",
        lastHeartbeatAt: runtime.now(),
        failureMessage: healthy.message,
      };
      session.child = undefined;

      return {
        ok: false,
        message: healthy.message,
        preview: session.preview,
      };
    }

    session.preview = {
      ...session.preview,
      status: "running",
      lastHeartbeatAt: runtime.now(),
    };

    return {
      ok: true,
      message: "Preview is running.",
      preview: session.preview,
    };
  }

  async function stopInternal(workspaceRoot: string, message: string): Promise<ManagedPreviewSession | undefined> {
    const session = sessions.get(workspaceRoot);
    if (!session) {
      return undefined;
    }

    if (session.child) {
      await terminatePreviewProcess(session.child);
      session.child = undefined;
    }

    session.preview = {
      ...session.preview,
      status: "stopped",
      stoppedAt: runtime.now(),
      lastHeartbeatAt: runtime.now(),
      failureMessage: undefined,
    };
    sessions.set(workspaceRoot, session);

    return {
      ...session,
      preview: {
        ...session.preview,
      },
    };
  }
}

async function resolvePreviewCommand(
  workspaceRoot: string,
  port: number,
): Promise<
  | ({ ok: true } & PreviewCommandPlan)
  | {
      ok: false;
      command: string;
      message: string;
    }
> {
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  let packageJson: {
    packageManager?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as typeof packageJson;
  } catch {
    return {
      ok: false,
      command: "unknown",
      message: "Workspace is missing a readable package.json, so preview cannot be started.",
    };
  }

  if (!packageJson.scripts?.dev) {
    return {
      ok: false,
      command: "missing dev script",
      message: "Workspace package.json does not define a dev script for preview startup.",
    };
  }

  const packageManager = detectPackageManager(packageJson.packageManager);
  if (!packageManager) {
    return {
      ok: false,
      command: "unsupported package manager",
      message: "Preview startup currently supports npm, pnpm, and yarn workspaces only.",
    };
  }

  const hostFlag = detectHostFlag(packageJson);
  const rawArgs =
    packageManager === "npm"
      ? ["run", "dev", "--", hostFlag, "127.0.0.1", "--port", String(port)]
      : ["dev", hostFlag, "127.0.0.1", "--port", String(port)];
  const invocation = resolvePackageManagerInvocation(packageManager, rawArgs);
  const command = [packageManager, ...rawArgs].join(" ");

  return {
    ok: true,
    file: invocation.file,
    args: invocation.args,
    command,
    env: {
      HOST: "127.0.0.1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
  };
}

function detectPackageManager(packageManagerValue: string | undefined): "npm" | "pnpm" | "yarn" | undefined {
  if (!packageManagerValue) {
    return "npm";
  }

  if (packageManagerValue.startsWith("pnpm@")) {
    return "pnpm";
  }

  if (packageManagerValue.startsWith("yarn@")) {
    return "yarn";
  }

  if (packageManagerValue.startsWith("npm@")) {
    return "npm";
  }

  return undefined;
}

function detectHostFlag(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): "--hostname" | "--host" {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if ("next" in dependencies) {
    return "--hostname";
  }

  return "--host";
}

function resolvePackageManagerInvocation(packageManager: "npm" | "pnpm" | "yarn", args: string[]): {
  file: string;
  args: string[];
} {
  if (process.platform !== "win32") {
    return {
      file: packageManager,
      args,
    };
  }

  if (packageManager === "npm" || packageManager === "pnpm" || packageManager === "yarn") {
    return {
      file: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", `${packageManager}.cmd`, ...args],
    };
  }

  return {
    file: packageManager,
    args,
  };
}

async function reservePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to reserve a preview port."));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForPreviewHealth(input: {
  fetchImpl: typeof globalThis.fetch;
  setTimeoutImpl: typeof globalThis.setTimeout;
  url: string;
  timeoutMs: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await input.fetchImpl(input.url, { method: "GET" });
      if (response.ok || response.status < 500) {
        return { ok: true };
      }
    } catch {
      // Poll until deadline.
    }

    await new Promise<void>((resolve) => input.setTimeoutImpl(resolve, PREVIEW_POLL_INTERVAL_MS));
  }

  return {
    ok: false,
    message: "Preview process did not become healthy before the startup timeout elapsed.",
  };
}

async function terminatePreviewProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve, reject) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
      });
      killer.on("error", reject);
      killer.on("close", () => resolve());
    });
    return;
  }

  await new Promise<void>((resolve) => {
    child.once("close", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 2_000);
  });
}

function formatExit(code: number | null, signal: NodeJS.Signals | null): string {
  if (typeof code === "number") {
    return `exit code ${code}`;
  }

  if (signal) {
    return `signal ${signal}`;
  }

  return "unknown exit";
}
