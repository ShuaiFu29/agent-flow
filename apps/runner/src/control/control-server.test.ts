import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startRunnerControlServer } from "./control-server";

describe("runner control server", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => removeDirectoryWithRetries(root)),
    );
  });

  it("serves workspace scan and read endpoints behind a bearer token", async () => {
    const workspaceRoot = await createWorkspace({
      "package.json": "{ \"name\": \"demo-app\" }\n",
      "apps/web/app/page.tsx": "export default function Page() { return <main />; }\n",
    });
    const server = await startRunnerControlServer({
      workspaceRoot,
      token: "token_123",
    });

    try {
      const scanResponse = await fetch(`${server.baseUrl}/workspace/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
          maxEntries: 100,
          maxDepth: 4,
        }),
      });
      const scanBody = await scanResponse.json();

      expect(scanResponse.status).toBe(200);
      expect(scanBody.keyFiles).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "package.json" })]),
      );

      const readResponse = await fetch(`${server.baseUrl}/workspace/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
          paths: ["package.json"],
        }),
      });
      const readBody = await readResponse.json();

      expect(readResponse.status).toBe(200);
      expect(readBody.files[0]?.content).toContain("demo-app");

      const precheckResponse = await fetch(`${server.baseUrl}/patch/precheck`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
          patch: [
            "diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx",
            "--- a/apps/web/app/page.tsx",
            "+++ b/apps/web/app/page.tsx",
            "@@ -1 +1 @@",
            "-export default function Page() { return <main />; }",
            "+export default function Page() { return <section />; }",
            "",
          ].join("\n"),
        }),
      });
      const precheckBody = await precheckResponse.json();

      expect(precheckResponse.status).toBe(200);
      expect(precheckBody.ok).toBe(true);

      const patchResponse = await fetch(`${server.baseUrl}/patch/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
          patch: [
            "diff --git a/apps/web/app/page.tsx b/apps/web/app/page.tsx",
            "--- a/apps/web/app/page.tsx",
            "+++ b/apps/web/app/page.tsx",
            "@@ -1 +1 @@",
            "-export default function Page() { return <main />; }",
            "+export default function Page() { return <section />; }",
            "",
          ].join("\n"),
        }),
      });
      const patchBody = await patchResponse.json();

      expect(patchResponse.status).toBe(200);
      expect(patchBody.ok).toBe(true);

      const commandResponse = await fetch(`${server.baseUrl}/commands/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
          command: "npm test",
        }),
      });
      const commandBody = await commandResponse.json();

      expect(commandResponse.status).toBe(200);
      expect(commandBody.exitCode).toBe(0);

      const previewStartResponse = await fetch(`${server.baseUrl}/preview/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
        }),
      });
      const previewStartBody = await previewStartResponse.json();

      expect(previewStartResponse.status).toBe(200);
      expect(previewStartBody.ok).toBe(true);
      expect(previewStartBody.preview?.status).toBe("running");

      const previewStatusResponse = await fetch(`${server.baseUrl}/preview/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
        }),
      });
      const previewStatusBody = await previewStatusResponse.json();

      expect(previewStatusResponse.status).toBe(200);
      expect(previewStatusBody.preview?.status).toBe("running");

      const previewStopResponse = await fetch(`${server.baseUrl}/preview/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token_123",
        },
        body: JSON.stringify({
          workspaceRoot,
        }),
      });
      const previewStopBody = await previewStopResponse.json();

      expect(previewStopResponse.status).toBe(200);
      expect(previewStopBody.preview?.status).toBe("stopped");

      const rejected = await fetch(`${server.baseUrl}/workspace/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceRoot,
          maxEntries: 100,
          maxDepth: 4,
        }),
      });

      expect(rejected.status).toBe(401);
    } finally {
      await server.close();
    }
  }, 20_000);

  async function createWorkspace(files: Record<string, string>): Promise<string> {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-control-"));
    tempRoots.push(workspaceRoot);

    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const absolutePath = path.join(workspaceRoot, relativePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content, "utf8");
      }),
    );

    await fs.writeFile(
      path.join(workspaceRoot, "package.json"),
      JSON.stringify({
        name: "demo-app",
        version: "1.0.0",
        scripts: {
          test: "node -e \"console.log('control ok')\"",
          dev: "node preview-server.mjs",
        },
      }),
      "utf8",
    );
    await fs.writeFile(
      path.join(workspaceRoot, "preview-server.mjs"),
      [
        'import http from "node:http";',
        'const port = Number(process.env.PORT || "3100");',
        'const host = process.env.HOST || "127.0.0.1";',
        "const server = http.createServer((_, response) => {",
        '  response.statusCode = 200;',
        '  response.end("preview ok");',
        "});",
        "server.listen(port, host);",
        'process.on("SIGTERM", () => server.close(() => process.exit(0)));',
      ].join("\n"),
      "utf8",
    );

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync("git", ["init"], { cwd: workspaceRoot });
    await execFileAsync("git", ["config", "user.email", "agent-flow@example.com"], { cwd: workspaceRoot });
    await execFileAsync("git", ["config", "user.name", "agent-flow"], { cwd: workspaceRoot });

    return workspaceRoot;
  }
});

async function removeDirectoryWithRetries(root: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EBUSY" || attempt === 4) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}
