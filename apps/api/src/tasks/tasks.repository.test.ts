import { describe, expect, it } from "vitest";
import { InMemoryTasksRepository } from "./tasks.repository";

describe("InMemoryTasksRepository", () => {
  it("stores tasks, events, and artifacts behind a repository boundary", () => {
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

    repository.createTask(task);
    repository.addEvent(event);
    repository.addArtifact(artifact);
    repository.updateTask({
      ...task,
      status: "completed",
      updatedAt: "2026-06-24T00:00:01.000Z",
    });

    expect(repository.listTasks()).toEqual([
      expect.objectContaining({ id: task.id, status: "completed" }),
    ]);
    expect(repository.getTask(task.id)).toEqual(
      expect.objectContaining({ id: task.id, status: "completed" }),
    );
    expect(repository.listEvents(task.id)).toEqual([event]);
    expect(repository.listArtifacts(task.id)).toEqual([artifact]);
  });

  it("returns empty event and artifact collections for known tasks without records", () => {
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
  });
});
