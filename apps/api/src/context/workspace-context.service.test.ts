import { describe, expect, it } from "vitest";
import { InMemoryTasksRepository } from "../tasks/tasks.repository";
import { RunnerService } from "../runner/runner.service";
import { WorkspaceContextService } from "./workspace-context.service";

describe("WorkspaceContextService", () => {
  it("collects real context for an online workspace through the runner control plane", async () => {
    const repository = new InMemoryTasksRepository();
    const runnerService = new RunnerService(repository, () => "2026-06-24T00:00:00.000Z");
    await runnerService.register({
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
    });
    const service = new WorkspaceContextService(runnerService, {
      scanWorkspace: async () => ({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        branch: "feat/v1-workspace-runner",
        topLevelEntries: ["apps", "packages", "package.json"],
        keyFiles: [
          { path: "package.json", size: 100, reason: "Workspace manifest" },
          { path: "apps/api/src/tasks/tasks.service.ts", size: 200, reason: "Task workflow" },
        ],
        stackHints: ["pnpm", "typescript", "nestjs"],
      }),
      readFiles: async () => ({
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        files: [
          { path: "package.json", content: "{ \"name\": \"agent-flow\" }" },
          { path: "apps/api/src/tasks/tasks.service.ts", content: "export class TasksService {}" },
        ],
      }),
    });

    const workspace = (await runnerService.listWorkspaces())[0];
    if (!workspace) {
      throw new Error("workspace was not registered");
    }

    const context = await service.collect(workspace, "Add email login flow");

    expect(context.branch).toBe("feat/v1-workspace-runner");
    expect(context.stackHints).toContain("nestjs");
    expect(context.keyFiles).toHaveLength(2);
    expect(context.files[0]?.path).toBe("package.json");
    expect(context.selectedFiles.length).toBeGreaterThan(0);
  });

  it("throws a clear error when no online runner session can serve the workspace", async () => {
    const repository = new InMemoryTasksRepository();
    const runnerService = new RunnerService(repository, () => "2026-06-24T00:00:00.000Z");
    const service = new WorkspaceContextService(runnerService, {
      scanWorkspace: async () => {
        throw new Error("should not be called");
      },
      readFiles: async () => {
        throw new Error("should not be called");
      },
    });

    await expect(
      service.collect({
        id: "workspace_missing",
        name: "missing",
        rootPath: "D:\\project\\missing",
        status: "online",
        runnerMode: "local",
      }, "Runner unavailable"),
    ).rejects.toThrow(/runner session/i);
  });
});
