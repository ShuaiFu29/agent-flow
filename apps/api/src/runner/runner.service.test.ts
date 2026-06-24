import { describe, expect, it } from "vitest";
import type { RunnerControlMessage } from "@agent-flow/shared";
import { InMemoryTasksRepository } from "../tasks/tasks.repository";
import { RunnerService } from "./runner.service";

describe("RunnerService", () => {
  it("registers a runner and exposes a real workspace record", async () => {
    const repository = new InMemoryTasksRepository();
    const service = new RunnerService(repository, () => "2026-06-24T00:00:00.000Z");
    const message: RunnerControlMessage = {
      type: "runner_register",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      workspaceName: "agent-flow",
      branch: "feat/v1-workspace-runner",
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      protocolVersion: "v1",
      capabilities: ["scan_workspace", "read_files", "run_command"],
      createdAt: "2026-06-24T00:00:00.000Z",
    };

    const response = await service.register(message);
    const workspaces = await service.listWorkspaces();
    const sessions = await service.listRunnerSessions();

    expect(response.accepted).toBe(true);
    expect(response.workspaceId).toBe(workspaces[0]?.id);
    expect(workspaces).toEqual([
      expect.objectContaining({
        name: "agent-flow",
        rootPath: "D:\\project\\agent\\agent-flow",
        status: "online",
        runnerMode: "local",
        runnerId: "runner_1",
      }),
    ]);
    expect(sessions).toEqual([
      expect.objectContaining({
        runnerId: "runner_1",
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        status: "online",
        controlBaseUrl: "http://127.0.0.1:43123",
      }),
    ]);
  });

  it("refreshes heartbeat state and marks stale runners offline", async () => {
    const repository = new InMemoryTasksRepository();
    let now = "2026-06-24T00:00:00.000Z";
    const service = new RunnerService(repository, () => now);

    await service.register({
      type: "runner_register",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      workspaceName: "agent-flow",
      branch: "feat/v1-workspace-runner",
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      protocolVersion: "v1",
      capabilities: ["scan_workspace", "read_files", "run_command"],
      createdAt: now,
    });

    now = "2026-06-24T00:00:05.000Z";
    const heartbeat = await service.heartbeat({
      type: "runner_heartbeat",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      status: "online",
      sentAt: now,
    });

    expect(heartbeat.accepted).toBe(true);
    expect((await service.listWorkspaces())[0]?.lastHeartbeatAt).toBe(now);

    now = "2026-06-24T00:00:25.000Z";

    await expect(service.listWorkspaces()).resolves.toEqual([
      expect.objectContaining({
        status: "offline",
      }),
    ]);
    await expect(service.listRunnerSessions()).resolves.toEqual([
      expect.objectContaining({
        status: "offline",
      }),
    ]);
    await expect(service.getOnlineSessionForWorkspace((await service.listWorkspaces())[0]!.id)).resolves.toBeUndefined();
  });
});
