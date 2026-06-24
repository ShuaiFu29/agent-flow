import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readWorkspaceFiles, scanWorkspace } from "./workspace-scan";

describe("workspace scan", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
    );
  });

  it("collects top-level entries, key files, and stack hints from an allowed workspace", async () => {
    const workspaceRoot = await createWorkspace({
      "package.json": JSON.stringify({
        name: "demo-app",
        packageManager: "pnpm@10.0.0",
        dependencies: {
          next: "15.0.0",
          react: "19.0.0",
        },
        devDependencies: {
          typescript: "5.0.0",
        },
      }),
      "pnpm-workspace.yaml": "packages:\n  - apps/*\n",
      "apps/web/app/page.tsx": "export default function Page() { return <main />; }\n",
      "packages/shared/src/index.ts": "export const value = 1;\n",
      ".env": "SECRET=1\n",
      "node_modules/left-pad/index.js": "module.exports = () => {};\n",
    });

    const response = await scanWorkspace({
      workspaceRoot,
      maxDepth: 4,
      maxEntries: 200,
    });

    expect(response.workspaceRoot).toBe(workspaceRoot);
    expect(response.topLevelEntries).toEqual(expect.arrayContaining(["apps", "package.json", "packages"]));
    expect(response.keyFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "package.json" }),
        expect.objectContaining({ path: "apps/web/app/page.tsx" }),
      ]),
    );
    expect(response.stackHints).toEqual(expect.arrayContaining(["pnpm", "typescript", "nextjs", "react"]));
    expect(response.keyFiles.map((file: { path: string }) => file.path)).not.toContain(".env");
    expect(response.keyFiles.map((file: { path: string }) => file.path)).not.toContain("node_modules/left-pad/index.js");
  });

  it("reads only allowed files inside the workspace", async () => {
    const workspaceRoot = await createWorkspace({
      "package.json": "{ \"name\": \"demo-app\" }\n",
      "apps/web/app/page.tsx": "export default function Page() { return <main />; }\n",
      ".env.local": "SECRET=2\n",
    });

    const response = await readWorkspaceFiles({
      workspaceRoot,
      paths: ["package.json", "apps/web/app/page.tsx"],
    });

    expect(response.files).toEqual([
      expect.objectContaining({ path: "package.json" }),
      expect.objectContaining({ path: "apps/web/app/page.tsx" }),
    ]);

    await expect(
      readWorkspaceFiles({
        workspaceRoot,
        paths: [".env.local"],
      }),
    ).rejects.toThrow(/Sensitive file|not readable/i);
  });

  async function createWorkspace(files: Record<string, string>): Promise<string> {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-runner-"));
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
