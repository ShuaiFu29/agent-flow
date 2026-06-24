import { afterEach, describe, expect, it, vi } from "vitest";
import {
  heartbeatRunner,
  registerRunner,
} from "./runner-api";

describe("runner API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts runner registration to the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accepted: true,
        workspaceId: "workspace_agent_flow",
        sessionId: "session_runner_1",
        status: "online",
        message: "Runner registered.",
        receivedAt: "2026-06-24T00:00:00.000Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await registerRunner("http://localhost:4000", {
      type: "runner_register",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      workspaceName: "agent-flow",
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      branch: "feat/v1-workspace-runner",
      protocolVersion: "v1",
      capabilities: ["scan_workspace", "read_files", "run_command"],
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/runner/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "runner_register",
        runnerId: "runner_1",
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        workspaceName: "agent-flow",
        controlBaseUrl: "http://127.0.0.1:43123",
        controlToken: "token_123",
        branch: "feat/v1-workspace-runner",
        protocolVersion: "v1",
        capabilities: ["scan_workspace", "read_files", "run_command"],
        createdAt: "2026-06-24T00:00:00.000Z",
      }),
    });
    expect(response.accepted).toBe(true);
  });

  it("posts runner heartbeats to the API and surfaces network errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      heartbeatRunner("http://localhost:4000", {
        type: "runner_heartbeat",
        runnerId: "runner_1",
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        status: "online",
        sentAt: "2026-06-24T00:00:05.000Z",
      }),
    ).rejects.toThrow("connect ECONNREFUSED");
  });
});
