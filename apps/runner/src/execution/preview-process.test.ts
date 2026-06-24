import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPreviewProcessManager } from "./preview-process";

const tempRoots: string[] = [];

describe("preview process manager", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it("starts, reports, and stops a local preview server for a workspace", async () => {
    const workspaceRoot = await createWorkspace({
      "preview-server.mjs": [
        'import http from "node:http";',
        'const port = Number(process.env.PORT || "3100");',
        'const host = process.env.HOST || "127.0.0.1";',
        "const server = http.createServer((_, response) => {",
        '  response.statusCode = 200;',
        '  response.setHeader("Content-Type", "text/plain");',
        '  response.end("preview ok");',
        "});",
        "server.listen(port, host);",
        'process.on("SIGTERM", () => server.close(() => process.exit(0)));',
      ].join("\n"),
    });
    const manager = createPreviewProcessManager();

    const started = await manager.startPreview({ workspaceRoot });
    expect(started.ok).toBe(true);
    expect(started.preview?.status).toBe("running");
    expect(started.preview?.url).toContain("127.0.0.1");

    const current = await manager.getPreviewState({ workspaceRoot });
    expect(current.ok).toBe(true);
    expect(current.preview?.status).toBe("running");
    expect(current.preview?.port).toBe(started.preview?.port);

    const stopped = await manager.stopPreview({ workspaceRoot });
    expect(stopped.ok).toBe(true);
    expect(stopped.preview?.status).toBe("stopped");
    expect(stopped.preview?.stoppedAt).toBeTruthy();
  });

  it("returns a failed preview state when the workspace has no dev script", async () => {
    const workspaceRoot = await createWorkspace({});
    const manager = createPreviewProcessManager();

    const result = await manager.startPreview({ workspaceRoot });

    expect(result.ok).toBe(false);
    expect(result.preview?.status).toBe("failed");
    expect(result.preview?.failureMessage).toContain("dev");
  });
});

async function createWorkspace(extraFiles: Record<string, string>): Promise<string> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-preview-"));
  tempRoots.push(workspaceRoot);

  await fs.writeFile(
    path.join(workspaceRoot, "package.json"),
    JSON.stringify({
      name: "preview-app",
      version: "1.0.0",
      packageManager: "npm@10.0.0",
      scripts: extraFiles["preview-server.mjs"]
        ? {
            dev: "node preview-server.mjs",
          }
        : {},
    }),
    "utf8",
  );

  await Promise.all(
    Object.entries(extraFiles).map(async ([relativePath, content]) => {
      const absolutePath = path.join(workspaceRoot, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, "utf8");
    }),
  );

  return workspaceRoot;
}
