import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CommandRun, ContextSnapshot, PatchLifecycle, PreviewSession } from "@agent-flow/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRunsPanel, ContextSnapshotPanel, PatchLifecyclePanel, TaskStageSummary } from "../components/dashboard";
import { AgentFlowApiClient } from "./api";

describe("AgentFlowApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a task through the V0 API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "task_1",
        title: "\u589e\u52a0\u90ae\u7bb1\u767b\u5f55\u6d41\u7a0b",
        prompt: "\u589e\u52a0\u767b\u5f55\u9875\u9762",
        status: "completed",
        createdAt: "2026-06-23T00:00:00.000Z",
        updatedAt: "2026-06-23T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AgentFlowApiClient("http://localhost:4000");
    const task = await client.createTask({
      title: "\u589e\u52a0\u90ae\u7bb1\u767b\u5f55\u6d41\u7a0b",
      prompt: "\u589e\u52a0\u767b\u5f55\u9875\u9762",
    });

    expect(task.id).toBe("task_1");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/tasks", {
      body: JSON.stringify({
        title: "\u589e\u52a0\u90ae\u7bb1\u767b\u5f55\u6d41\u7a0b",
        prompt: "\u589e\u52a0\u767b\u5f55\u9875\u9762",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("loads tasks, events, artifacts, approvals, audit events, workspaces, task sources, patch lifecycle, command runs, and preview state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([{ id: "task_1", title: "\u4efb\u52a1", prompt: "\u63d0\u793a", status: "completed" }]),
      )
      .mockResolvedValueOnce(jsonResponse([{ id: "event_1", taskId: "task_1", type: "task_created" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "artifact_1", taskId: "task_1", kind: "plan" }]))
      .mockResolvedValueOnce(
        jsonResponse([{ id: "approval_1", taskId: "task_1", kind: "apply_patch", status: "pending" }]),
      )
      .mockResolvedValueOnce(
        jsonResponse([{ id: "audit_1", taskId: "task_1", source: "system", action: "task_created" }]),
      )
      .mockResolvedValueOnce(jsonResponse([{ id: "workspace_1", name: "demo-app", status: "online" }]))
      .mockResolvedValueOnce(
        jsonResponse({ id: "source_1", taskId: "task_1", kind: "manual", title: "\u4efb\u52a1\u6765\u6e90" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "patch_1",
          taskId: "task_1",
          patchArtifactId: "artifact_1",
          approvalId: "approval_1",
          status: "awaiting_approval",
          precheck: {
            status: "passed",
            changedFiles: ["src/task-target.ts"],
            message: "Patch precheck passed.",
            issues: [],
          },
          applyResult: {
            status: "not_started",
            changedFiles: ["src/task-target.ts"],
            message: "Patch has not been applied yet.",
          },
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "command_1",
            taskId: "task_1",
            approvalId: "approval_2",
            command: "pnpm test",
            status: "passed",
            exitCode: 0,
            stdout: "task test ok\\n",
            stderr: "",
            createdAt: "2026-06-24T00:00:00.000Z",
            updatedAt: "2026-06-24T00:00:05.000Z",
            startedAt: "2026-06-24T00:00:01.000Z",
            completedAt: "2026-06-24T00:00:05.000Z",
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "preview_1",
          taskId: "task_1",
          workspaceId: "workspace_1",
          status: "running",
          url: "http://127.0.0.1:3100",
          port: 3100,
          command: "npm run dev -- --host 127.0.0.1 --port 3100",
          startedAt: "2026-06-24T00:00:00.000Z",
          lastHeartbeatAt: "2026-06-24T00:00:02.000Z",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AgentFlowApiClient("http://localhost:4000");

    await expect(client.listTasks()).resolves.toHaveLength(1);
    await expect(client.listEvents("task_1")).resolves.toHaveLength(1);
    await expect(client.listArtifacts("task_1")).resolves.toHaveLength(1);
    await expect(client.listApprovals("task_1")).resolves.toHaveLength(1);
    await expect(client.listAuditEvents("task_1")).resolves.toHaveLength(1);
    await expect(client.listWorkspaces()).resolves.toHaveLength(1);
    await expect(client.getTaskSource("task_1")).resolves.toMatchObject({
      id: "source_1",
      taskId: "task_1",
    });
    await expect(client.getPatchLifecycle("task_1")).resolves.toMatchObject({
      id: "patch_1",
      taskId: "task_1",
      status: "awaiting_approval",
    });
    await expect(client.getCommandRuns("task_1")).resolves.toHaveLength(1);
    await expect(client.getPreviewSession("task_1")).resolves.toMatchObject({
      id: "preview_1",
      taskId: "task_1",
      status: "running",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/tasks", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/tasks/task_1/events", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/tasks/task_1/artifacts", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "http://localhost:4000/tasks/task_1/approvals", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(5, "http://localhost:4000/tasks/task_1/audit", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(6, "http://localhost:4000/workspaces", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(7, "http://localhost:4000/tasks/task_1/source", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(8, "http://localhost:4000/tasks/task_1/patch-lifecycle", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(9, "http://localhost:4000/tasks/task_1/command-runs", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(10, "http://localhost:4000/tasks/task_1/preview", { cache: "no-store" });
  });

  it("loads a task context snapshot through the V2 API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "snapshot_1",
        taskId: "task_1",
        selectedFiles: [{ path: "src/task-target.ts", reason: "Primary task target", relevance: "high" }],
        rejectedFiles: [{ path: ".env", reason: "Sensitive file" }],
        createdAt: "2026-06-24T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AgentFlowApiClient("http://localhost:4000");

    await expect(client.getTaskContext("task_1")).resolves.toMatchObject({
      id: "snapshot_1",
      taskId: "task_1",
      selectedFiles: [{ path: "src/task-target.ts", reason: "Primary task target", relevance: "high" }],
      rejectedFiles: [{ path: ".env", reason: "Sensitive file" }],
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/tasks/task_1/context", { cache: "no-store" });
  });

  it("approves and rejects approvals through the V1 API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ id: "approval_1", taskId: "task_1", kind: "apply_patch", status: "approved" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "approval_2", taskId: "task_1", kind: "run_command", status: "rejected" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AgentFlowApiClient("http://localhost:4000");

    await expect(client.approveApproval("approval_1")).resolves.toMatchObject({
      id: "approval_1",
      status: "approved",
    });
    await expect(client.rejectApproval("approval_2")).resolves.toMatchObject({
      id: "approval_2",
      status: "rejected",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/approvals/approval_1/approve", {
      method: "POST",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/approvals/approval_2/reject", {
      method: "POST",
    });
  });

  it("starts, restarts, and stops preview through the V2.5 API", async () => {
    const preview: PreviewSession = {
      id: "preview_1",
      taskId: "task_1",
      workspaceId: "workspace_1",
      status: "running",
      url: "http://127.0.0.1:3100",
      port: 3100,
      command: "npm run dev -- --host 127.0.0.1 --port 3100",
      startedAt: "2026-06-24T00:00:00.000Z",
      lastHeartbeatAt: "2026-06-24T00:00:02.000Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(preview))
      .mockResolvedValueOnce(
        jsonResponse({
          ...preview,
          startedAt: "2026-06-24T00:00:05.000Z",
          lastHeartbeatAt: "2026-06-24T00:00:06.000Z",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...preview,
          status: "stopped",
          stoppedAt: "2026-06-24T00:00:07.000Z",
          lastHeartbeatAt: "2026-06-24T00:00:07.000Z",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AgentFlowApiClient("http://localhost:4000");

    await expect(client.startPreview("task_1")).resolves.toMatchObject({
      id: "preview_1",
      status: "running",
    });
    await expect(client.restartPreview("task_1")).resolves.toMatchObject({
      id: "preview_1",
      startedAt: "2026-06-24T00:00:05.000Z",
    });
    await expect(client.stopPreview("task_1")).resolves.toMatchObject({
      id: "preview_1",
      status: "stopped",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/tasks/task_1/preview/start", {
      method: "POST",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/tasks/task_1/preview/restart", {
      method: "POST",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/tasks/task_1/preview/stop", {
      method: "POST",
    });
  });

  it("throws a useful error when the API returns a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }));

    const client = new AgentFlowApiClient("http://localhost:4000");

    await expect(client.listTasks()).rejects.toThrow("API request failed: 500 Server Error");
  });

  it("renders selected and rejected context from the real snapshot instead of demo placeholders", () => {
    const snapshot: ContextSnapshot = {
      id: "snapshot_1",
      taskId: "task_1",
      selectedFiles: [{ path: "src/task-target.ts", reason: "Primary task target", relevance: "high" }],
      rejectedFiles: [{ path: ".env", reason: "Sensitive file" }],
      createdAt: "2026-06-24T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(createElement(ContextSnapshotPanel, { snapshot }));

    expect(markup).toContain('data-testid="context-selected-list"');
    expect(markup).toContain('data-testid="context-rejected-list"');
    expect(markup).toContain("src/task-target.ts");
    expect(markup).toContain("Primary task target");
    expect(markup).toContain(".env");
    expect(markup).toContain("Sensitive file");
    expect(markup).not.toContain("apps/web/app/login/page.tsx");
  });

  it("renders patch lifecycle details from the real API response", () => {
    const lifecycle: PatchLifecycle = {
      id: "patch_1",
      taskId: "task_1",
      patchArtifactId: "artifact_1",
      approvalId: "approval_1",
      status: "awaiting_approval",
      precheck: {
        status: "passed",
        changedFiles: ["src/task-target.ts"],
        message: "Patch precheck passed.",
        issues: [],
        checkedAt: "2026-06-24T00:00:00.000Z",
      },
      applyResult: {
        status: "not_started",
        changedFiles: ["src/task-target.ts"],
        message: "Patch has not been applied yet.",
      },
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
    };

    const markup = renderToStaticMarkup(createElement(PatchLifecyclePanel, { lifecycle }));

    expect(markup).toContain("Patch");
    expect(markup).toContain("Patch precheck passed.");
    expect(markup).toContain("src/task-target.ts");
    expect(markup).toContain("Patch has not been applied yet.");
  });

  it("renders command verification details from the real API response", () => {
    const commandRuns: CommandRun[] = [
      {
        id: "command_1",
        taskId: "task_1",
        approvalId: "approval_2",
        command: "pnpm test",
        status: "passed",
        exitCode: 0,
        stdout: "task test ok\n",
        stderr: "",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:05.000Z",
        startedAt: "2026-06-24T00:00:01.000Z",
        completedAt: "2026-06-24T00:00:05.000Z",
      },
    ];

    const markup = renderToStaticMarkup(createElement(CommandRunsPanel, { commandRuns }));

    expect(markup).toContain("命令验证");
    expect(markup).toContain("pnpm test");
    expect(markup).toContain("task test ok");
    expect(markup).toContain("通过");
  });

  it("renders the explicit task stage summary", () => {
    const markup = renderToStaticMarkup(
      createElement(TaskStageSummary, {
        task: {
          id: "task_1",
          title: "阶段展示",
          prompt: "展示任务阶段",
          status: "waiting_for_approval",
          stage: "verification",
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
      }),
    );

    expect(markup).toContain("任务阶段");
    expect(markup).toContain("命令验证");
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  } as Response;
}
