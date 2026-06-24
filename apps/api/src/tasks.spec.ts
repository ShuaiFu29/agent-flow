import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import "reflect-metadata";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";

const execFileAsync = promisify(execFile);

type PreviewFixtureState = {
  child?: ChildProcessWithoutNullStreams;
  preview: {
    status: "starting" | "running" | "stopped" | "failed";
    url: string;
    port: number;
    command: string;
    startedAt: string;
    stoppedAt?: string;
    lastHeartbeatAt?: string;
    failureMessage?: string;
  };
};

function createPreviewFixtureManager() {
  const sessions = new Map<string, PreviewFixtureState>();

  return {
    async startPreview(input: { workspaceRoot: string }) {
      const normalizedWorkspaceRoot = path.resolve(input.workspaceRoot);
      const existing = sessions.get(normalizedWorkspaceRoot);
      if (existing?.child) {
        await stopSession(normalizedWorkspaceRoot, "Preview restarted.");
      }

      const port = await reservePreviewPort();
      const startedAt = new Date().toISOString();
      const command = `npm run dev -- --host 127.0.0.1 --port ${port}`;
      const invocation =
        process.platform === "win32"
          ? {
              file: process.env.ComSpec ?? "cmd.exe",
              args: ["/d", "/s", "/c", "npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
            }
          : {
              file: "npm",
              args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)],
            };
      const child = spawn(invocation.file, invocation.args, {
        cwd: normalizedWorkspaceRoot,
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          HOSTNAME: "127.0.0.1",
          PORT: String(port),
        },
        shell: false,
        windowsHide: true,
      });

      const session: PreviewFixtureState = {
        child,
        preview: {
          status: "starting",
          url: `http://127.0.0.1:${port}`,
          port,
          command,
          startedAt,
        },
      };
      sessions.set(normalizedWorkspaceRoot, session);

      child.on("error", (error) => {
        session.preview = {
          ...session.preview,
          status: "failed",
          lastHeartbeatAt: new Date().toISOString(),
          failureMessage: error.message,
        };
        session.child = undefined;
      });
      child.on("close", (code) => {
        if (session.preview.status === "stopped") {
          session.child = undefined;
          return;
        }

        session.preview = {
          ...session.preview,
          status: "failed",
          lastHeartbeatAt: new Date().toISOString(),
          failureMessage: `Preview process exited unexpectedly (exit code ${code ?? 1}).`,
        };
        session.child = undefined;
      });

      const healthy = await waitForPreviewHealth(session.preview.url);
      if (!healthy) {
        await terminatePreviewFixtureChild(child);
        session.preview = {
          ...session.preview,
          status: "failed",
          lastHeartbeatAt: new Date().toISOString(),
          failureMessage: "Preview process did not become healthy before timeout.",
        };
        session.child = undefined;

        return {
          ok: false,
          message: "Preview process did not become healthy before timeout.",
          preview: session.preview,
        };
      }

      session.preview = {
        ...session.preview,
        status: "running",
        lastHeartbeatAt: new Date().toISOString(),
      };

      return {
        ok: true,
        message: "Preview is running.",
        preview: session.preview,
      };
    },

    async stopPreview(input: { workspaceRoot: string }) {
      const stopped = await stopSession(path.resolve(input.workspaceRoot), "Preview stopped.");
      if (!stopped) {
        return {
          ok: false,
          message: "No preview session found for the workspace.",
        };
      }

      return {
        ok: true,
        message: "Preview stopped.",
        preview: stopped.preview,
      };
    },

    async restartPreview(input: { workspaceRoot: string }) {
      await stopSession(path.resolve(input.workspaceRoot), "Preview restarted.");
      return await this.startPreview(input);
    },

    async getPreviewState(input: { workspaceRoot: string }) {
      const session = sessions.get(path.resolve(input.workspaceRoot));
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

    async shutdown() {
      for (const workspaceRoot of Array.from(sessions.keys())) {
        await stopSession(workspaceRoot, "Preview stopped.");
      }
    },
  };

  async function stopSession(workspaceRoot: string, _message: string) {
    const session = sessions.get(workspaceRoot);
    if (!session) {
      return undefined;
    }

    if (session.child) {
      await terminatePreviewFixtureChild(session.child);
      session.child = undefined;
    }

    const now = new Date().toISOString();
    session.preview = {
      ...session.preview,
      status: "stopped",
      stoppedAt: session.preview.stoppedAt ?? now,
      lastHeartbeatAt: now,
      failureMessage: undefined,
    };
    sessions.set(workspaceRoot, session);

    return session;
  }
}

describe("tasks API", () => {
  let app: INestApplication | undefined;
  let controlServer: ReturnType<typeof createServer> | undefined;
  let controlBaseUrl = "";
  let workspaceRoot = "";
  let databaseUrl = "";
  let previousDatabaseUrl: string | undefined;
  let forcePatchPrecheckFailure = false;
  let forcePreviewFailure = false;
  const controlToken = "token_123";
  const tempRoots: string[] = [];
  const previewManager = createPreviewFixtureManager();

  beforeEach(async () => {
    previousDatabaseUrl = process.env.DATABASE_URL;
    forcePatchPrecheckFailure = false;
    forcePreviewFailure = false;
    const databaseRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-api-db-"));
    tempRoots.push(databaseRoot);
    databaseUrl = toSqliteDatabaseUrl(path.join(databaseRoot, "agent-flow.db"));
    process.env.DATABASE_URL = databaseUrl;

    workspaceRoot = await createWorkspace({
      testScript: "node -e \"console.log('task test ok')\"",
    });

    controlServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.headers.authorization !== `Bearer ${controlToken}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Unauthorized" }));
        return;
      }

      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on("end", async () => {
        try {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          const body = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};

          if (req.method === "POST" && req.url === "/workspace/scan") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                workspaceRoot,
                branch: "feat/v1-workspace-runner",
                topLevelEntries: ["package.json", "src"],
                keyFiles: [
                  { path: "package.json", size: 180, reason: "Workspace manifest" },
                  { path: "src/task-target.ts", size: 128, reason: "Primary task target" },
                  { path: "README.md", size: 92, reason: "Project overview" },
                  { path: "src/secondary.ts", size: 64, reason: "Secondary module" },
                ],
                stackHints: ["pnpm", "typescript"],
              }),
            );
            return;
          }

          if (req.method === "POST" && req.url === "/workspace/read") {
            const paths = Array.isArray(body.paths) ? (body.paths as string[]) : [];
            const files = await Promise.all(
              paths.map(async (relativePath) => ({
                path: relativePath,
                content: await fs.readFile(path.join(workspaceRoot, relativePath), "utf8"),
              })),
            );
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ workspaceRoot, files }));
            return;
          }

          if (req.method === "POST" && req.url === "/patch/apply") {
            const patch = String(body.patch ?? "");
            const result = await applyPatchWithGit(workspaceRoot, patch);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
          }

          if (req.method === "POST" && req.url === "/patch/precheck") {
            const patch = String(body.patch ?? "");
            const result = forcePatchPrecheckFailure
              ? {
                  ok: false,
                  message: "Patch precheck failed for test fixture.",
                  changedFiles: ["src/task-target.ts"],
                  failureCode: "patch_check_failed",
                  issues: [
                    {
                      code: "patch_check_failed",
                      message: "Patch precheck failed for test fixture.",
                    },
                  ],
                }
              : await precheckPatchWithGit(workspaceRoot, patch);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
          }

          if (req.method === "POST" && req.url === "/commands/run") {
            const command = String(body.command ?? "");
            const result = await runWorkspaceCommand(workspaceRoot, command);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
          }

          if (req.method === "POST" && req.url === "/preview/start") {
            const result = forcePreviewFailure
              ? {
                  ok: false,
                  message: "Preview fixture intentionally failed to start.",
                  preview: {
                    status: "failed",
                    url: "http://127.0.0.1:3999",
                    port: 3999,
                    command: "npm run dev -- --host 127.0.0.1 --port 3999",
                    startedAt: new Date().toISOString(),
                    lastHeartbeatAt: new Date().toISOString(),
                    failureMessage: "Preview fixture intentionally failed to start.",
                  },
                }
              : await previewManager.startPreview({ workspaceRoot });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
          }

          if (req.method === "POST" && req.url === "/preview/status") {
            const result = await previewManager.getPreviewState({ workspaceRoot });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
          }

          if (req.method === "POST" && req.url === "/preview/stop") {
            const result = await previewManager.stopPreview({ workspaceRoot });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
          }

          if (req.method === "POST" && req.url === "/preview/restart") {
            const result = await previewManager.restartPreview({ workspaceRoot });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
            return;
          }

          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Not found" }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : "Control server error",
            }),
          );
        }
      });
    });

    const server = getControlServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        controlBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await closeApp();
    await closeControlServer();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  async function registerRunner(input?: { createdAt?: string }): Promise<void> {
    await request(getHttpServer())
      .post("/runner/register")
      .send({
        type: "runner_register",
        runnerId: "runner_1",
        workspaceRoot,
        workspaceName: "agent-flow-task-fixture",
        branch: "feat/v1-workspace-runner",
        protocolVersion: "v1",
        capabilities: ["scan_workspace", "read_files", "run_command", "apply_patch", "preview_server"],
        controlBaseUrl,
        controlToken,
        createdAt: input?.createdAt ?? new Date().toISOString(),
      })
      .expect(201);
  }

  it("creates a task with real workspace-derived artifacts and waits for approvals", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Add email login flow",
        prompt: "Create a login page with email and password support.",
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      title: "Add email login flow",
      prompt: "Create a login page with email and password support.",
      status: "waiting_for_approval",
      stage: "patch_approval",
    });

    const taskId = createResponse.body.id as string;

    const taskResponse = await request(getHttpServer()).get(`/tasks/${taskId}`).expect(200);
    expect(taskResponse.body.id).toBe(taskId);

    const eventsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/events`)
      .expect(200);
    expect(eventsResponse.body.map((event: { type: string }) => event.type)).not.toContain("task_completed");

    const artifactsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/artifacts`)
      .expect(200);
    expect(artifactsResponse.body.map((artifact: { kind: string }) => artifact.kind)).toEqual([
      "workspace_summary",
      "plan",
      "patch",
      "review",
      "test_log",
      "final_report",
    ]);
    expect(artifactsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "workspace_summary",
          content: expect.stringContaining("feat/v1-workspace-runner"),
        }),
        expect.objectContaining({
          kind: "plan",
          content: expect.stringContaining("src/task-target.ts"),
        }),
        expect.objectContaining({
          kind: "patch",
          content: expect.stringContaining("diff --git a/src/task-target.ts b/src/task-target.ts"),
        }),
        expect.objectContaining({
          kind: "review",
          content: expect.stringContaining("未执行"),
        }),
      ]),
    );

    const snapshotResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/context`)
      .expect(200);
    expect(snapshotResponse.body).toMatchObject({
      taskId,
      selectedFiles: expect.arrayContaining([
        expect.objectContaining({
          path: "src/task-target.ts",
        }),
      ]),
    });
    expect(snapshotResponse.body.rejectedFiles.length).toBeGreaterThan(0);

    const patchLifecycleResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/patch-lifecycle`)
      .expect(200);
    expect(patchLifecycleResponse.body).toMatchObject({
      taskId,
      status: "awaiting_approval",
      precheck: expect.objectContaining({
        status: "passed",
      }),
      applyResult: expect.objectContaining({
        status: "not_started",
      }),
    });

    const approvalsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/approvals`)
      .expect(200);
    expect(approvalsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId,
          kind: "apply_patch",
          status: "pending",
        }),
        expect.objectContaining({
          taskId,
          kind: "run_command",
          status: "pending",
        }),
      ]),
    );
  });

  it("approves patch and command, executes them, and completes the task", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Apply a real patch",
        prompt: "Insert a traceable comment into the target file and then run tests.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    const approvalsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/approvals`)
      .expect(200);
    const patchApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "apply_patch");
    const commandApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "run_command");

    expect(patchApproval).toBeDefined();
    expect(commandApproval).toBeDefined();

    await request(getHttpServer()).post(`/approvals/${patchApproval.id}/approve`).expect(201);
    await expect(fs.readFile(path.join(workspaceRoot, "src/task-target.ts"), "utf8")).resolves.toContain(
      "agent-flow planned change",
    );

    const patchLifecycleAfterApply = await request(getHttpServer())
      .get(`/tasks/${taskId}/patch-lifecycle`)
      .expect(200);
    expect(patchLifecycleAfterApply.body).toMatchObject({
      taskId,
      status: "applied",
      approvalId: patchApproval.id,
      applyResult: expect.objectContaining({
        status: "applied",
      }),
    });

    const taskAfterPatch = await request(getHttpServer()).get(`/tasks/${taskId}`).expect(200);
    expect(taskAfterPatch.body.status).toBe("waiting_for_approval");
    expect(taskAfterPatch.body.stage).toBe("verification");

    await request(getHttpServer()).post(`/approvals/${commandApproval.id}/approve`).expect(201);

    const completedTask = await request(getHttpServer()).get(`/tasks/${taskId}`).expect(200);
    expect(completedTask.body.status).toBe("completed");
    expect(completedTask.body.stage).toBe("completed");

    const artifactsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/artifacts`).expect(200);
    expect(artifactsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "test_log",
          content: expect.stringContaining("task test ok"),
        }),
        expect.objectContaining({
          kind: "final_report",
          content: expect.stringContaining("completed"),
        }),
      ]),
    );

    const auditResponse = await request(getHttpServer()).get(`/tasks/${taskId}/audit`).expect(200);
    expect(auditResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "approval_granted",
          source: "user",
        }),
        expect.objectContaining({
          action: "patch_applied",
          source: "runner",
        }),
        expect.objectContaining({
          action: "command_completed",
          source: "runner",
        }),
      ]),
    );
  });

  it("persists command-run lifecycle from queued to passed after command approval", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Track command lifecycle",
        prompt: "Apply the patch and keep the verification lifecycle structured.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    const approvalsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/approvals`)
      .expect(200);
    const patchApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "apply_patch");
    const commandApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "run_command");

    expect(patchApproval).toBeDefined();
    expect(commandApproval).toBeDefined();

    const queuedRunsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/command-runs`)
      .expect(200);
    expect(queuedRunsResponse.body).toEqual([
      expect.objectContaining({
        taskId,
        approvalId: commandApproval.id,
        command: "pnpm test",
        status: "queued",
      }),
    ]);

    await request(getHttpServer()).post(`/approvals/${patchApproval.id}/approve`).expect(201);
    await request(getHttpServer()).post(`/approvals/${commandApproval.id}/approve`).expect(201);

    const completedRunsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/command-runs`)
      .expect(200);
    expect(completedRunsResponse.body).toEqual([
      expect.objectContaining({
        taskId,
        approvalId: commandApproval.id,
        command: "pnpm test",
        status: "passed",
        exitCode: 0,
        stdout: expect.stringContaining("task test ok"),
        stderr: "",
      }),
    ]);
  });

  it("fails the task before approval when patch precheck fails and persists the lifecycle", async () => {
    await registerRunner();
    forcePatchPrecheckFailure = true;

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Precheck failure",
        prompt: "Create a patch that should be rejected by precheck.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    expect(createResponse.body.status).toBe("failed");

    const approvalsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/approvals`)
      .expect(200);
    expect(approvalsResponse.body).toEqual([]);

    const patchLifecycleResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/patch-lifecycle`)
      .expect(200);
    expect(patchLifecycleResponse.body).toMatchObject({
      taskId,
      status: "precheck_failed",
      precheck: expect.objectContaining({
        status: "failed",
        issues: [
          expect.objectContaining({
            code: "patch_check_failed",
          }),
        ],
      }),
    });

    const auditResponse = await request(getHttpServer()).get(`/tasks/${taskId}/audit`).expect(200);
    expect(auditResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "patch_precheck_failed",
          source: "runner",
        }),
      ]),
    );
  });

  it("marks the task failed when an approved command exits non-zero", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Fail command after patch",
        prompt: "Apply the patch and then run a failing test command.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    const approvalsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/approvals`).expect(200);
    const patchApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "apply_patch");
    const commandApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "run_command");

    await request(getHttpServer()).post(`/approvals/${patchApproval.id}/approve`).expect(201);
    await setWorkspaceTestScript(workspaceRoot, "node -e \"console.error('task test failed'); process.exit(2)\"");
    await request(getHttpServer()).post(`/approvals/${commandApproval.id}/approve`).expect(201);

    const failedTask = await request(getHttpServer()).get(`/tasks/${taskId}`).expect(200);
    expect(failedTask.body.status).toBe("failed");
    expect(failedTask.body.stage).toBe("failure_review");

    const commandRunsResponse = await request(getHttpServer())
      .get(`/tasks/${taskId}/command-runs`)
      .expect(200);
    expect(commandRunsResponse.body).toEqual([
      expect.objectContaining({
        taskId,
        command: "pnpm test",
        status: "failed",
        exitCode: 2,
        stderr: expect.stringContaining("task test failed"),
      }),
    ]);

    const artifactsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/artifacts`).expect(200);
    expect(artifactsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "test_log",
          content: expect.stringContaining("task test failed"),
        }),
      ]),
    );

    const auditResponse = await request(getHttpServer()).get(`/tasks/${taskId}/audit`).expect(200);
    expect(auditResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "command_completed",
          source: "runner",
          metadata: expect.objectContaining({ exitCode: 2 }),
        }),
      ]),
    );
  });

  it("starts, reads, restarts, and stops preview for a real task workspace", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Preview a real workspace",
        prompt: "Apply the patch and open the local preview.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    const approvalsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/approvals`).expect(200);
    const patchApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "apply_patch");
    expect(patchApproval).toBeDefined();

    await request(getHttpServer()).post(`/approvals/${patchApproval.id}/approve`).expect(201);

    const startedPreview = await request(getHttpServer()).post(`/tasks/${taskId}/preview/start`).expect(201);
    expect(startedPreview.body).toMatchObject({
      taskId,
      status: "running",
      url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
      command: expect.stringContaining("dev"),
    });

    const fetchedPreview = await request(getHttpServer()).get(`/tasks/${taskId}/preview`).expect(200);
    expect(fetchedPreview.body).toMatchObject({
      taskId,
      status: "running",
      url: startedPreview.body.url,
    });

    const restartedPreview = await request(getHttpServer()).post(`/tasks/${taskId}/preview/restart`).expect(201);
    expect(restartedPreview.body).toMatchObject({
      taskId,
      status: "running",
      url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
    });

    const stoppedPreview = await request(getHttpServer()).post(`/tasks/${taskId}/preview/stop`).expect(201);
    expect(stoppedPreview.body).toMatchObject({
      taskId,
      status: "stopped",
      stoppedAt: expect.any(String),
    });

    const previewAfterStop = await request(getHttpServer()).get(`/tasks/${taskId}/preview`).expect(200);
    expect(previewAfterStop.body).toMatchObject({
      taskId,
      status: "stopped",
      stoppedAt: expect.any(String),
    });

    const auditResponse = await request(getHttpServer()).get(`/tasks/${taskId}/audit`).expect(200);
    expect(auditResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "preview_started",
          source: "runner",
        }),
        expect.objectContaining({
          action: "preview_restarted",
          source: "runner",
        }),
        expect.objectContaining({
          action: "preview_stopped",
          source: "runner",
        }),
      ]),
    );
  });

  it("persists failed preview startup and audit state when preview launch fails", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Preview failure",
        prompt: "Apply the patch and exercise a failed preview start.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    const approvalsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/approvals`).expect(200);
    const patchApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "apply_patch");
    expect(patchApproval).toBeDefined();

    await request(getHttpServer()).post(`/approvals/${patchApproval.id}/approve`).expect(201);
    forcePreviewFailure = true;

    const failedPreview = await request(getHttpServer()).post(`/tasks/${taskId}/preview/start`).expect(201);
    expect(failedPreview.body).toMatchObject({
      taskId,
      status: "failed",
      failureMessage: "Preview fixture intentionally failed to start.",
    });

    const fetchedPreview = await request(getHttpServer()).get(`/tasks/${taskId}/preview`).expect(200);
    expect(fetchedPreview.body).toMatchObject({
      taskId,
      status: "failed",
      failureMessage: "Preview fixture intentionally failed to start.",
    });

    const auditResponse = await request(getHttpServer()).get(`/tasks/${taskId}/audit`).expect(200);
    expect(auditResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "preview_failed",
          source: "runner",
          message: "Preview fixture intentionally failed to start.",
        }),
      ]),
    );
  });

  it("lists tasks and returns 404 for unknown task ids", async () => {
    await registerRunner();

    await request(getHttpServer())
      .post("/tasks")
      .send({ title: "Task A", prompt: "Implement A" })
      .expect(201);

    const listResponse = await request(getHttpServer()).get("/tasks").expect(200);
    expect(listResponse.body).toHaveLength(1);

    const workspaceResponse = await request(getHttpServer()).get("/workspaces").expect(200);
    expect(workspaceResponse.body).toEqual([
      expect.objectContaining({
        rootPath: workspaceRoot,
        status: "online",
        runnerMode: "local",
      }),
    ]);

    const approvalsResponse = await request(getHttpServer()).get("/approvals").expect(200);
    expect(approvalsResponse.body.length).toBeGreaterThan(0);

    const auditResponse = await request(getHttpServer()).get("/audit").expect(200);
    expect(auditResponse.body.length).toBeGreaterThan(0);

    await request(getHttpServer()).get("/tasks/missing").expect(404);
  });

  it("exposes an SSE stream endpoint for task events", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({ title: "Task B", prompt: "Implement B" })
      .expect(201);

    const streamResponse = await request(getHttpServer())
      .get(`/tasks/${createResponse.body.id}/stream`)
      .set("Accept", "text/event-stream")
      .buffer(false)
      .expect(200);

    expect(streamResponse.headers["content-type"]).toContain("text/event-stream");
  });

  it("accepts runner heartbeats and keeps the workspace online", async () => {
    await registerRunner();
    const heartbeatAt = new Date().toISOString();

    const heartbeatResponse = await request(getHttpServer())
      .post("/runner/heartbeat")
      .send({
        type: "runner_heartbeat",
        runnerId: "runner_1",
        workspaceRoot,
        status: "online",
        sentAt: heartbeatAt,
      })
      .expect(201);

    expect(heartbeatResponse.body).toMatchObject({
      accepted: true,
      status: "online",
    });

    const workspaceResponse = await request(getHttpServer()).get("/workspaces").expect(200);
    expect(workspaceResponse.body).toEqual([
      expect.objectContaining({
        rootPath: workspaceRoot,
        status: "online",
        lastHeartbeatAt: heartbeatAt,
      }),
    ]);
  });

  it("restores tasks, approvals, artifacts, audit, source, and workspace state after app restart", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Restart persistence",
        prompt: "Keep everything available after restart.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    await restartApp();

    const listResponse = await request(getHttpServer()).get("/tasks").expect(200);
    expect(listResponse.body).toEqual([
      expect.objectContaining({
        id: taskId,
        status: "waiting_for_approval",
      }),
    ]);

    const workspaceResponse = await request(getHttpServer()).get("/workspaces").expect(200);
    expect(workspaceResponse.body).toEqual([
      expect.objectContaining({
        rootPath: workspaceRoot,
        runnerMode: "local",
      }),
    ]);

    const approvalsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/approvals`).expect(200);
    expect(approvalsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "apply_patch", status: "pending" }),
        expect.objectContaining({ kind: "run_command", status: "pending" }),
      ]),
    );

    const artifactsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/artifacts`).expect(200);
    expect(artifactsResponse.body.map((artifact: { kind: string }) => artifact.kind)).toEqual([
      "workspace_summary",
      "plan",
      "patch",
      "review",
      "test_log",
      "final_report",
    ]);

    const auditResponse = await request(getHttpServer()).get(`/tasks/${taskId}/audit`).expect(200);
    expect(auditResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "task_created" }),
        expect.objectContaining({ action: "context_snapshot_created" }),
        expect.objectContaining({ action: "approval_requested" }),
      ]),
    );

    const sourceResponse = await request(getHttpServer()).get(`/tasks/${taskId}/source`).expect(200);
    expect(sourceResponse.body).toMatchObject({
      taskId,
      kind: "manual",
      title: "Restart persistence",
    });

    const snapshotResponse = await request(getHttpServer()).get(`/tasks/${taskId}/context`).expect(200);
    expect(snapshotResponse.body).toMatchObject({
      taskId,
      selectedFiles: expect.any(Array),
    });
  });

  it("shows a persisted runner session as offline after restart when the heartbeat is stale", async () => {
    const staleAt = new Date(Date.now() - 20_000).toISOString();
    await registerRunner({ createdAt: staleAt });

    await restartApp();

    const workspaceResponse = await request(getHttpServer()).get("/workspaces").expect(200);
    expect(workspaceResponse.body).toEqual([
      expect.objectContaining({
        rootPath: workspaceRoot,
        status: "offline",
        lastHeartbeatAt: staleAt,
      }),
    ]);

    const runnerSessionsResponse = await request(getHttpServer()).get("/runner-sessions").expect(200);
    expect(runnerSessionsResponse.body).toEqual([
      expect.objectContaining({
        runnerId: "runner_1",
        status: "offline",
        lastHeartbeatAt: staleAt,
      }),
    ]);
  });

  it("rejects creating a new task when the only persisted workspace is stale after restart", async () => {
    const staleAt = new Date(Date.now() - 20_000).toISOString();
    await registerRunner({ createdAt: staleAt });

    await restartApp();

    await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Should not run on stale workspace",
        prompt: "Do not bind new work to an offline runner.",
      })
      .expect(404);
  });

  it("keeps failed tasks reviewable after restart", async () => {
    await registerRunner();

    const createResponse = await request(getHttpServer())
      .post("/tasks")
      .send({
        title: "Persist failed execution",
        prompt: "Fail after command execution and keep the record.",
      })
      .expect(201);
    const taskId = createResponse.body.id as string;

    const approvalsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/approvals`).expect(200);
    const patchApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "apply_patch");
    const commandApproval = approvalsResponse.body.find((approval: { kind: string }) => approval.kind === "run_command");

    await request(getHttpServer()).post(`/approvals/${patchApproval.id}/approve`).expect(201);
    await setWorkspaceTestScript(workspaceRoot, "node -e \"console.error('persisted failure'); process.exit(2)\"");
    await request(getHttpServer()).post(`/approvals/${commandApproval.id}/approve`).expect(201);

    await restartApp();

    const failedTask = await request(getHttpServer()).get(`/tasks/${taskId}`).expect(200);
    expect(failedTask.body.status).toBe("failed");

    const artifactsResponse = await request(getHttpServer()).get(`/tasks/${taskId}/artifacts`).expect(200);
    expect(artifactsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "test_log",
          content: expect.stringContaining("persisted failure"),
        }),
        expect.objectContaining({
          kind: "final_report",
          content: expect.stringContaining("failed"),
        }),
      ]),
    );

    const auditResponse = await request(getHttpServer()).get(`/tasks/${taskId}/audit`).expect(200);
    expect(auditResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "command_completed",
          metadata: expect.objectContaining({ exitCode: 2 }),
        }),
        expect.objectContaining({
          action: "task_failed",
        }),
      ]),
    );
  });

  async function createWorkspace(input: { testScript: string }): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-api-task-"));
    tempRoots.push(root);

    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src/task-target.ts"), "export const taskTarget = 'ready';\n", "utf8");
    await fs.writeFile(path.join(root, "src/secondary.ts"), "export const secondaryTarget = 'ready';\n", "utf8");
    await fs.writeFile(path.join(root, "README.md"), "# agent-flow api fixture\n", "utf8");
    await fs.writeFile(
      path.join(root, "preview-server.mjs"),
      [
        'import http from "node:http";',
        "",
        'const host = process.env.HOST ?? process.env.HOSTNAME ?? "127.0.0.1";',
        'const port = Number(process.env.PORT ?? "3000");',
        "",
        "const server = http.createServer((_request, response) => {",
        '  response.writeHead(200, { "Content-Type": "text/plain" });',
        '  response.end("agent-flow preview ok");',
        "});",
        "",
        "server.listen(port, host);",
        "",
        "const shutdown = () => {",
        "  server.close(() => process.exit(0));",
        "};",
        "",
        'process.on("SIGTERM", shutdown);',
        'process.on("SIGINT", shutdown);',
      ].join("\n"),
      "utf8",
    );
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify(
        {
          name: "agent-flow-api-fixture",
          version: "1.0.0",
          scripts: {
            dev: "node preview-server.mjs",
            test: input.testScript,
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    await execFileAsync("git", ["init"], { cwd: root });
    await execFileAsync("git", ["config", "user.email", "agent-flow@example.com"], { cwd: root });
    await execFileAsync("git", ["config", "user.name", "agent-flow"], { cwd: root });

    return root;
  }

  async function restartApp(): Promise<void> {
    await closeApp();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }

  async function closeApp(): Promise<void> {
    if (!app) {
      return;
    }

    await app.close();
    app = undefined;
  }

  async function closeControlServer(): Promise<void> {
    await previewManager.shutdown();

    if (!controlServer) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      controlServer!.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    controlServer = undefined;
  }

  function getHttpServer() {
    if (!app) {
      throw new Error("Nest application is not initialized.");
    }

    return app.getHttpServer();
  }

  function getControlServer() {
    if (!controlServer) {
      throw new Error("Control server is not initialized.");
    }

    return controlServer;
  }
});

async function applyPatchWithGit(
  workspaceRoot: string,
  patchContent: string,
): Promise<{
  ok: boolean;
  message: string;
  changedFiles: string[];
  issues: Array<{ code: string; message: string }>;
  failureCode?: string;
}> {
  const patchDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-api-patch-"));
  const patchPath = path.join(patchDir, "task.patch");
  try {
    await fs.writeFile(patchPath, patchContent, "utf8");
    await execFileAsync("git", ["apply", "--check", patchPath], { cwd: workspaceRoot });
    await execFileAsync("git", ["apply", patchPath], { cwd: workspaceRoot });
    return {
      ok: true,
      message: "Patch applied.",
      changedFiles: extractPatchPaths(patchContent),
      issues: [],
    };
  } finally {
    await fs.rm(patchDir, { recursive: true, force: true });
  }
}

async function precheckPatchWithGit(
  workspaceRoot: string,
  patchContent: string,
): Promise<{
  ok: boolean;
  message: string;
  changedFiles: string[];
  issues: Array<{ code: string; message: string }>;
  failureCode?: string;
}> {
  const patchDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-api-patch-"));
  const patchPath = path.join(patchDir, "task.patch");
  try {
    await fs.writeFile(patchPath, patchContent, "utf8");
    await execFileAsync("git", ["apply", "--check", patchPath], { cwd: workspaceRoot });
    return {
      ok: true,
      message: "Patch precheck passed.",
      changedFiles: extractPatchPaths(patchContent),
      issues: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Patch precheck failed.";
    return {
      ok: false,
      message,
      changedFiles: extractPatchPaths(patchContent),
      failureCode: "patch_check_failed",
      issues: [
        {
          code: "patch_check_failed",
          message,
        },
      ],
    };
  } finally {
    await fs.rm(patchDir, { recursive: true, force: true });
  }
}

function extractPatchPaths(patchContent: string): string[] {
  const matches = patchContent.matchAll(/^\+\+\+ b\/(.+)$/gm);
  return Array.from(matches, (match) => match[1]).filter((value): value is string => Boolean(value));
}

async function runWorkspaceCommand(
  workspaceRoot: string,
  command: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const [file, ...args] = command.split(" ");
  if (!file) {
    throw new Error("Command must not be empty.");
  }

  const invocation =
    process.platform === "win32" && (file === "npm" || file === "pnpm")
      ? { file: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", `${file}.cmd`, ...args] }
      : { file, args };

  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(invocation.file, invocation.args, {
      cwd: workspaceRoot,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function reservePreviewPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createNetServer();
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

async function waitForPreviewHealth(url: string): Promise<boolean> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // Poll until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return false;
}

async function terminatePreviewFixtureChild(child: ChildProcessWithoutNullStreams): Promise<void> {
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
    }, 1_000);
  });
}

async function setWorkspaceTestScript(workspaceRoot: string, script: string): Promise<void> {
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  packageJson.scripts = {
    ...(packageJson.scripts ?? {}),
    test: script,
  };
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf8");
}

function toSqliteDatabaseUrl(databasePath: string): string {
  return `file:${databasePath.replaceAll("\\", "/")}`;
}
