import { describe, expect, it } from "vitest";
import { InMemoryTasksRepository } from "./tasks.repository";

describe("InMemoryTasksRepository", () => {
  it("stores tasks, events, artifacts, approvals, audit events, and task sources behind a repository boundary", () => {
    const repository = new InMemoryTasksRepository();
    const task = {
      id: "task_1",
      title: "V0 persistence boundary",
      prompt: "Keep task storage outside TasksService.",
      status: "running" as const,
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
    };
    const event = {
      id: "event_1",
      taskId: task.id,
      type: "task_created" as const,
      message: "Task created.",
      createdAt: "2026-06-24T00:00:00.000Z",
    };
    const artifact = {
      id: "artifact_1",
      taskId: task.id,
      kind: "plan" as const,
      title: "Plan",
      content: "Plan content",
      createdAt: "2026-06-24T00:00:00.000Z",
    };
    const approval = {
      id: "approval_1",
      taskId: task.id,
      kind: "apply_patch" as const,
      status: "pending" as const,
      payload: { artifactId: artifact.id },
      createdAt: "2026-06-24T00:00:00.000Z",
    };
    const auditEvent = {
      id: "audit_1",
      taskId: task.id,
      workspaceId: "workspace_1",
      source: "system" as const,
      action: "approval_requested",
      message: "Approval required.",
      createdAt: "2026-06-24T00:00:00.000Z",
    };
    const taskSource = {
      id: "source_1",
      taskId: task.id,
      kind: "manual" as const,
      title: "Manual request",
      content: "Implement V0 closure.",
      createdAt: "2026-06-24T00:00:00.000Z",
    };
    const patchLifecycle = {
      id: "patch_1",
      taskId: task.id,
      patchArtifactId: artifact.id,
      approvalId: approval.id,
      status: "awaiting_approval" as const,
      precheck: {
        status: "passed" as const,
        changedFiles: ["apps/api/src/tasks/tasks.service.ts"],
        message: "Patch precheck passed.",
        issues: [],
        checkedAt: "2026-06-24T00:00:00.500Z",
      },
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:01.000Z",
    };
    const commandRun = {
      id: "command_1",
      taskId: task.id,
      approvalId: approval.id,
      command: "pnpm test",
      status: "passed" as const,
      exitCode: 0,
      stdout: "task test ok\n",
      stderr: "",
      createdAt: "2026-06-24T00:00:02.500Z",
      updatedAt: "2026-06-24T00:00:06.000Z",
      startedAt: "2026-06-24T00:00:03.000Z",
      completedAt: "2026-06-24T00:00:06.000Z",
      outputArtifactId: artifact.id,
    };
    const previewSession = {
      id: "preview_1",
      taskId: task.id,
      workspaceId: "workspace_1",
      status: "running" as const,
      url: "http://127.0.0.1:3100",
      port: 3100,
      command: "pnpm dev -- --port 3100 --hostname 127.0.0.1",
      startedAt: "2026-06-24T00:00:07.000Z",
      lastHeartbeatAt: "2026-06-24T00:00:08.000Z",
    };

    repository.createTask(task);
    repository.addEvent(event);
    repository.addArtifact(artifact);
    repository.addApproval(approval);
    repository.addAuditEvent(auditEvent);
    repository.setTaskSource(taskSource);
    repository.setPatchLifecycle(patchLifecycle);
    repository.setCommandRun(commandRun);
    repository.setPreviewSession(previewSession);
    repository.updateTask({
      ...task,
      status: "completed",
      updatedAt: "2026-06-24T00:00:01.000Z",
    });
    repository.updateArtifact({
      ...artifact,
      content: "Updated plan content",
    });
    repository.updateApproval({
      ...approval,
      status: "approved",
      decidedAt: "2026-06-24T00:00:02.000Z",
    });

    expect(repository.listTasks()).toEqual([
      expect.objectContaining({ id: task.id, status: "completed" }),
    ]);
    expect(repository.getTask(task.id)).toEqual(
      expect.objectContaining({ id: task.id, status: "completed" }),
    );
    expect(repository.listEvents(task.id)).toEqual([event]);
    expect(repository.getApproval(approval.id)).toEqual(
      expect.objectContaining({ id: approval.id, status: "approved" }),
    );
    expect(repository.listArtifacts(task.id)).toEqual([
      expect.objectContaining({ id: artifact.id, content: "Updated plan content" }),
    ]);
    expect(repository.listApprovals()).toEqual([
      expect.objectContaining({ id: approval.id, status: "approved" }),
    ]);
    expect(repository.listApprovals(task.id)).toEqual([
      expect.objectContaining({ id: approval.id, status: "approved" }),
    ]);
    expect(repository.listAuditEvents()).toEqual([auditEvent]);
    expect(repository.listAuditEvents(task.id)).toEqual([auditEvent]);
    expect(repository.getTaskSource(task.id)).toEqual(taskSource);
    expect(repository.getPatchLifecycle(task.id)).toEqual(patchLifecycle);
    expect(repository.listCommandRuns(task.id)).toEqual([commandRun]);
    expect(repository.getPreviewSessionByTaskId(task.id)).toEqual(previewSession);
    expect(repository.getActivePreviewSessionByWorkspaceId("workspace_1")).toEqual(previewSession);
  });

  it("returns empty event, artifact, approval, audit, and command-run collections for known tasks without records", () => {
    const repository = new InMemoryTasksRepository();

    repository.createTask({
      id: "task_empty",
      title: "Empty task",
      prompt: "No records yet.",
      status: "running",
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
    });

    expect(repository.listEvents("task_empty")).toEqual([]);
    expect(repository.listArtifacts("task_empty")).toEqual([]);
    expect(repository.listApprovals("task_empty")).toEqual([]);
    expect(repository.listAuditEvents("task_empty")).toEqual([]);
    expect(repository.getTaskSource("task_empty")).toBeUndefined();
    expect(repository.getPatchLifecycle("task_empty")).toBeUndefined();
    expect(repository.listCommandRuns("task_empty")).toEqual([]);
    expect(repository.getPreviewSessionByTaskId("task_empty")).toBeUndefined();
    expect(repository.getActivePreviewSessionByWorkspaceId("workspace_1")).toBeUndefined();
  });

  it("starts with no registered workspaces or runner sessions", () => {
    const repository = new InMemoryTasksRepository();

    expect(repository.listWorkspaces()).toEqual([]);
    expect(repository.listRunnerSessions()).toEqual([]);
  });
});
