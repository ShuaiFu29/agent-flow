import { afterEach, describe, expect, it, vi } from "vitest";
import { RunnerContextClient } from "./runner-context.client";

describe("RunnerContextClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls runner scan, read, patch precheck, patch apply, and command endpoints with bearer auth", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          workspaceRoot: "D:\\project\\agent\\agent-flow",
          branch: "feat/v1-workspace-runner",
          topLevelEntries: ["apps", "packages", "package.json"],
          keyFiles: [{ path: "package.json", size: 100, reason: "Workspace manifest" }],
          stackHints: ["pnpm", "typescript"],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workspaceRoot: "D:\\project\\agent\\agent-flow",
          files: [{ path: "package.json", content: "{ \"name\": \"agent-flow\" }" }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          message: "Patch precheck passed.",
          changedFiles: ["apps/api/src/tasks/tasks.service.ts"],
          issues: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          message: "Patch applied.",
          changedFiles: ["apps/api/src/tasks/tasks.service.ts"],
          issues: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          exitCode: 0,
          stdout: "ok\n",
          stderr: "",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new RunnerContextClient();

    const scan = await client.scanWorkspace({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      maxEntries: 100,
      maxDepth: 4,
    });
    const read = await client.readFiles({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      paths: ["package.json"],
    });
    const precheck = await client.precheckPatch({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      patch: "diff --git a/a.ts b/a.ts",
    });
    const patch = await client.applyPatch({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      patch: "diff --git a/a.ts b/a.ts",
    });
    const command = await client.runCommand({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      command: "pnpm test",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:43123/workspace/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        maxEntries: 100,
        maxDepth: 4,
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:43123/workspace/read", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        paths: ["package.json"],
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://127.0.0.1:43123/patch/precheck", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        patch: "diff --git a/a.ts b/a.ts",
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "http://127.0.0.1:43123/patch/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        patch: "diff --git a/a.ts b/a.ts",
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, "http://127.0.0.1:43123/commands/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        command: "pnpm test",
      }),
    });
    expect(scan.branch).toBe("feat/v1-workspace-runner");
    expect(read.files[0]?.content).toContain("agent-flow");
    expect(precheck.ok).toBe(true);
    expect(patch.ok).toBe(true);
    expect(command.exitCode).toBe(0);
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  } as Response;
}
