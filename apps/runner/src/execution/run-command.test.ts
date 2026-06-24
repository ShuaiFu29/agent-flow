import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAllowedCommand } from "./run-command";

describe("runAllowedCommand", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it("executes an allowlisted command and captures stdout/stderr/exitCode", async () => {
    const workspaceRoot = await createWorkspace({
      "package.json": JSON.stringify({
        name: "demo-runner-command",
        version: "1.0.0",
        scripts: {
          test: "node -e \"console.log('runner ok'); console.error('runner err')\"",
        },
      }),
    });

    const result = await runAllowedCommand({
      workspaceRoot,
      command: "npm test",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("runner ok");
    expect(result.stderr).toContain("runner err");
  });

  it("returns a non-zero exit code for failing commands", async () => {
    const workspaceRoot = await createWorkspace({
      "package.json": JSON.stringify({
        name: "demo-runner-command-fail",
        version: "1.0.0",
        scripts: {
          test: "node -e \"console.error('runner fail'); process.exit(2)\"",
        },
      }),
    });

    const result = await runAllowedCommand({
      workspaceRoot,
      command: "npm test",
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("runner fail");
  });

  async function createWorkspace(files: Record<string, string>): Promise<string> {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-command-"));
    tempRoots.push(workspaceRoot);

    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const absolutePath = path.join(workspaceRoot, relativePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content, "utf8");
      }),
    );

    return workspaceRoot;
  }
});
