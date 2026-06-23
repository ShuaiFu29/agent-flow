import { Injectable } from "@nestjs/common";
import type {
  AgentFlowEvent,
  Approval,
  Artifact,
  AuditEvent,
  Task,
  TaskSource,
  Workspace,
} from "@agent-flow/shared";

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
  addApproval(approval: Approval): Approval;
  listApprovals(taskId?: string): Approval[];
  addAuditEvent(event: AuditEvent): AuditEvent;
  listAuditEvents(taskId?: string): AuditEvent[];
  setTaskSource(source: TaskSource): TaskSource;
  getTaskSource(taskId: string): TaskSource | undefined;
  listWorkspaces(): Workspace[];
}

@Injectable()
export class InMemoryTasksRepository implements TasksRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly events = new Map<string, AgentFlowEvent[]>();
  private readonly artifacts = new Map<string, Artifact[]>();
  private readonly approvals = new Map<string, Approval[]>();
  private readonly taskSources = new Map<string, TaskSource>();
  private readonly auditEvents: AuditEvent[] = [];
  private readonly workspaces: Workspace[] = createSeedWorkspaces();

  createTask(task: Task): Task {
    this.tasks.set(task.id, task);
    this.events.set(task.id, []);
    this.artifacts.set(task.id, []);
    this.approvals.set(task.id, []);

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

  addApproval(approval: Approval): Approval {
    this.approvals.get(approval.taskId)?.push(approval);

    return approval;
  }

  listApprovals(taskId?: string): Approval[] {
    if (taskId) {
      return this.approvals.get(taskId) ?? [];
    }

    return Array.from(this.approvals.values()).flat();
  }

  addAuditEvent(event: AuditEvent): AuditEvent {
    this.auditEvents.push(event);

    return event;
  }

  listAuditEvents(taskId?: string): AuditEvent[] {
    if (!taskId) {
      return [...this.auditEvents];
    }

    return this.auditEvents.filter((event) => event.taskId === taskId);
  }

  setTaskSource(source: TaskSource): TaskSource {
    this.taskSources.set(source.taskId, source);

    return source;
  }

  getTaskSource(taskId: string): TaskSource | undefined {
    return this.taskSources.get(taskId);
  }

  listWorkspaces(): Workspace[] {
    return [...this.workspaces];
  }
}

function createSeedWorkspaces(): Workspace[] {
  return [
    {
      id: "workspace_demo_app",
      name: "demo-app",
      rootPath: "D:\\project\\demo-app",
      status: "online",
      runnerMode: "simulated",
      branch: "main",
      lastHeartbeatAt: "2026-06-24T03:55:00.000Z",
      createdAt: "2026-06-24T03:40:00.000Z",
      updatedAt: "2026-06-24T03:55:00.000Z",
    },
    {
      id: "workspace_admin_dashboard",
      name: "admin-dashboard",
      rootPath: "D:\\project\\admin-dashboard",
      status: "offline",
      runnerMode: "simulated",
      branch: "main",
      lastHeartbeatAt: "2026-06-23T22:10:00.000Z",
      createdAt: "2026-06-23T22:00:00.000Z",
      updatedAt: "2026-06-23T22:10:00.000Z",
    },
    {
      id: "workspace_mobile_api",
      name: "mobile-api",
      rootPath: "D:\\project\\mobile-api",
      status: "error",
      runnerMode: "simulated",
      branch: "develop",
      lastHeartbeatAt: "2026-06-23T20:30:00.000Z",
      createdAt: "2026-06-23T20:00:00.000Z",
      updatedAt: "2026-06-23T20:30:00.000Z",
    },
  ];
}
