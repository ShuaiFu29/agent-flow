import { afterEach, describe, expect, it, vi } from "vitest";
import { RunnerContextClient } from "./runner-context.client";

describe("RunnerContextClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls runner scan, read, patch precheck, patch apply, command, and preview endpoints with bearer auth", async () => {
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
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          message: "Preview is running.",
          preview: {
            status: "running",
            url: "http://127.0.0.1:3100",
            port: 3100,
            command: "pnpm dev --host 127.0.0.1 --port 3100",
            startedAt: "2026-06-24T00:00:00.000Z",
            lastHeartbeatAt: "2026-06-24T00:00:01.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          message: "Preview is running.",
          preview: {
            status: "running",
            url: "http://127.0.0.1:3100",
            port: 3100,
            command: "pnpm dev --host 127.0.0.1 --port 3100",
            startedAt: "2026-06-24T00:00:00.000Z",
            lastHeartbeatAt: "2026-06-24T00:00:01.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          message: "Preview is running.",
          preview: {
            status: "running",
            url: "http://127.0.0.1:3100",
            port: 3100,
            command: "pnpm dev --host 127.0.0.1 --port 3100",
            startedAt: "2026-06-24T00:00:02.000Z",
            lastHeartbeatAt: "2026-06-24T00:00:03.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          message: "Preview stopped.",
          preview: {
            status: "stopped",
            url: "http://127.0.0.1:3100",
            port: 3100,
            command: "pnpm dev --host 127.0.0.1 --port 3100",
            startedAt: "2026-06-24T00:00:00.000Z",
            lastHeartbeatAt: "2026-06-24T00:00:04.000Z",
            stoppedAt: "2026-06-24T00:00:04.000Z",
          },
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
    const startedPreview = await client.startPreview({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
    });
    const previewState = await client.getPreviewState({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
    });
    const restartedPreview = await client.restartPreview({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
    });
    const stoppedPreview = await client.stopPreview({
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
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
    expect(fetchMock).toHaveBeenNthCalledWith(6, "http://127.0.0.1:43123/preview/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(7, "http://127.0.0.1:43123/preview/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(8, "http://127.0.0.1:43123/preview/restart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(9, "http://127.0.0.1:43123/preview/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token_123",
      },
      body: JSON.stringify({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
      }),
    });
    expect(scan.branch).toBe("feat/v1-workspace-runner");
    expect(read.files[0]?.content).toContain("agent-flow");
    expect(precheck.ok).toBe(true);
    expect(patch.ok).toBe(true);
    expect(command.exitCode).toBe(0);
    expect(startedPreview.preview?.status).toBe("running");
    expect(previewState.preview?.url).toBe("http://127.0.0.1:3100");
    expect(restartedPreview.preview?.startedAt).toBe("2026-06-24T00:00:02.000Z");
    expect(stoppedPreview.preview?.status).toBe("stopped");
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  } as Response;
}
