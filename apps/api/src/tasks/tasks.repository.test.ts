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

    repository.createTask(task);
    repository.addEvent(event);
    repository.addArtifact(artifact);
    repository.addApproval(approval);
    repository.addAuditEvent(auditEvent);
    repository.setTaskSource(taskSource);
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
  });

  it("returns empty event, artifact, approval, and audit collections for known tasks without records", () => {
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
  });

  it("starts with no registered workspaces or runner sessions", () => {
    const repository = new InMemoryTasksRepository();

    expect(repository.listWorkspaces()).toEqual([]);
    expect(repository.listRunnerSessions()).toEqual([]);
  });
});
