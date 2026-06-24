import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { applyWorkspacePatch, precheckWorkspacePatch } from "./apply-patch";

const execFileAsync = promisify(execFile);

describe("applyWorkspacePatch", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it("applies a valid patch inside the workspace", async () => {
    const workspaceRoot = await createWorkspace({
      "src/example.ts": "export const value = 1;\n",
    });
    await initGitWorkspace(workspaceRoot);

    const patch = [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1 +1 @@",
      "-export const value = 1;",
      "+export const value = 2;",
      "",
    ].join("\n");

    const result = await applyWorkspacePatch({
      workspaceRoot,
      patch,
    });

    expect(result.ok).toBe(true);
    expect(result.changedFiles).toEqual(["src/example.ts"]);
    await expect(fs.readFile(path.join(workspaceRoot, "src/example.ts"), "utf8")).resolves.toContain("value = 2");
  });

  it("returns a structured failure when apply sees a path outside the workspace boundary", async () => {
    const workspaceRoot = await createWorkspace({
      "src/example.ts": "export const value = 1;\n",
    });
    await initGitWorkspace(workspaceRoot);

    const patch = [
      "diff --git a/../outside.txt b/../outside.txt",
      "--- a/../outside.txt",
      "+++ b/../outside.txt",
      "@@ -0,0 +1 @@",
      "+nope",
      "",
    ].join("\n");

    const result = await applyWorkspacePatch({
      workspaceRoot,
      patch,
    });

    expect(result).toMatchObject({
      ok: false,
      failureCode: "path_not_allowed",
    });
    expect(result.issues[0]?.message).toMatch(/outside the workspace|Path resolves outside/i);
  });

  it("prechecks a valid patch without mutating the workspace", async () => {
    const workspaceRoot = await createWorkspace({
      "src/example.ts": "export const value = 1;\n",
    });
    await initGitWorkspace(workspaceRoot);

    const patch = [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1 +1 @@",
      "-export const value = 1;",
      "+export const value = 2;",
      "",
    ].join("\n");

    const result = await precheckWorkspacePatch({
      workspaceRoot,
      patch,
    });

    expect(result).toMatchObject({
      ok: true,
      changedFiles: ["src/example.ts"],
    });
    await expect(fs.readFile(path.join(workspaceRoot, "src/example.ts"), "utf8")).resolves.toContain("value = 1");
  });

  it("returns a structured failure code when precheck sees a path outside the workspace", async () => {
    const workspaceRoot = await createWorkspace({
      "src/example.ts": "export const value = 1;\n",
    });
    await initGitWorkspace(workspaceRoot);

    const patch = [
      "diff --git a/../outside.txt b/../outside.txt",
      "--- a/../outside.txt",
      "+++ b/../outside.txt",
      "@@ -0,0 +1 @@",
      "+nope",
      "",
    ].join("\n");

    const result = await precheckWorkspacePatch({
      workspaceRoot,
      patch,
    });

    expect(result).toMatchObject({
      ok: false,
      failureCode: "path_not_allowed",
    });
    expect(result.issues[0]?.message).toMatch(/outside the workspace|Path resolves outside/i);
  });

  async function createWorkspace(files: Record<string, string>): Promise<string> {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-patch-"));
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

  async function initGitWorkspace(workspaceRoot: string): Promise<void> {
    await execFileAsync("git", ["init"], { cwd: workspaceRoot });
    await execFileAsync("git", ["config", "user.email", "agent-flow@example.com"], { cwd: workspaceRoot });
    await execFileAsync("git", ["config", "user.name", "agent-flow"], { cwd: workspaceRoot });
  }
});
