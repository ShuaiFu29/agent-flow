import { Injectable } from "@nestjs/common";
import type { AgentFlowEvent, Artifact, Task } from "@agent-flow/shared";

export const TASKS_REPOSITORY = "TASKS_REPOSITORY";

export interface TasksRepository {
  createTask(task: Task): Task;
  updateTask(task: Task): Task;
  listTasks(): Task[];
  getTask(taskId: string): Task | undefined;
  addEvent(event: AgentFlowEvent): AgentFlowEvent;
  listEvents(taskId: string): AgentFlowEvent[];
  addArtifact(artifact: Artifact): Artifact;
  listArtifacts(taskId: string): Artifact[];
}

@Injectable()
export class InMemoryTasksRepository implements TasksRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly events = new Map<string, AgentFlowEvent[]>();
  private readonly artifacts = new Map<string, Artifact[]>();

  createTask(task: Task): Task {
    this.tasks.set(task.id, task);
    this.events.set(task.id, []);
    this.artifacts.set(task.id, []);

    return task;
  }

  updateTask(task: Task): Task {
    this.tasks.set(task.id, task);

    return task;
  }

  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  addEvent(event: AgentFlowEvent): AgentFlowEvent {
    this.events.get(event.taskId)?.push(event);

    return event;
  }

  listEvents(taskId: string): AgentFlowEvent[] {
    return this.events.get(taskId) ?? [];
  }

  addArtifact(artifact: Artifact): Artifact {
    this.artifacts.get(artifact.taskId)?.push(artifact);

    return artifact;
  }

  listArtifacts(taskId: string): Artifact[] {
    return this.artifacts.get(taskId) ?? [];
  }
}
