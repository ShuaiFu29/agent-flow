import path from "node:path";
import { Injectable } from "@nestjs/common";
import type {
  AgentFlowEvent,
  Approval,
  Artifact,
  AuditEvent,
  CommandRun,
  ContextSnapshot,
  PatchLifecycle,
  PreviewSession,
  RunnerCapability,
  RunnerProtocolVersion,
  RunnerSession,
  RunnerStatus,
  Task,
  TaskSource,
  Workspace,
} from "@agent-flow/shared";

export const TASKS_REPOSITORY = "TASKS_REPOSITORY";
export type MaybePromise<T> = T | Promise<T>;

export type RegisterRunnerInput = {
  runnerId: string;
  workspaceRoot: string;
  workspaceName?: string;
  branch?: string;
  controlBaseUrl: string;
  controlToken: string;
  protocolVersion: RunnerProtocolVersion;
  capabilities: RunnerCapability[];
  createdAt: string;
};

export type HeartbeatRunnerInput = {
  runnerId: string;
  workspaceRoot: string;
  status: RunnerStatus;
  sentAt: string;
};

export interface TasksRepository {
  createTask(task: Task): MaybePromise<Task>;
  updateTask(task: Task): MaybePromise<Task>;
  listTasks(): MaybePromise<Task[]>;
  getTask(taskId: string): MaybePromise<Task | undefined>;
  addEvent(event: AgentFlowEvent): MaybePromise<AgentFlowEvent>;
  listEvents(taskId: string): MaybePromise<AgentFlowEvent[]>;
  addArtifact(artifact: Artifact): MaybePromise<Artifact>;
  updateArtifact(artifact: Artifact): MaybePromise<Artifact>;
  listArtifacts(taskId: string): MaybePromise<Artifact[]>;
  addApproval(approval: Approval): MaybePromise<Approval>;
  updateApproval(approval: Approval): MaybePromise<Approval>;
  getApproval(approvalId: string): MaybePromise<Approval | undefined>;
  listApprovals(taskId?: string): MaybePromise<Approval[]>;
  addAuditEvent(event: AuditEvent): MaybePromise<AuditEvent>;
  listAuditEvents(taskId?: string): MaybePromise<AuditEvent[]>;
  setTaskSource(source: TaskSource): MaybePromise<TaskSource>;
  getTaskSource(taskId: string): MaybePromise<TaskSource | undefined>;
  setContextSnapshot(snapshot: ContextSnapshot): MaybePromise<ContextSnapshot>;
  getContextSnapshot(taskId: string): MaybePromise<ContextSnapshot | undefined>;
  setPatchLifecycle(lifecycle: PatchLifecycle): MaybePromise<PatchLifecycle>;
  getPatchLifecycle(taskId: string): MaybePromise<PatchLifecycle | undefined>;
  setCommandRun(commandRun: CommandRun): MaybePromise<CommandRun>;
  listCommandRuns(taskId: string): MaybePromise<CommandRun[]>;
  setPreviewSession(previewSession: PreviewSession): MaybePromise<PreviewSession>;
  getPreviewSessionByTaskId(taskId: string): MaybePromise<PreviewSession | undefined>;
  getActivePreviewSessionByWorkspaceId(workspaceId: string): MaybePromise<PreviewSession | undefined>;
  registerRunner(input: RegisterRunnerInput): MaybePromise<{ workspace: Workspace; session: RunnerSession }>;
  heartbeatRunner(input: HeartbeatRunnerInput): MaybePromise<{ workspace: Workspace; session: RunnerSession } | undefined>;
  listWorkspaces(): MaybePromise<Workspace[]>;
  listRunnerSessions(): MaybePromise<RunnerSession[]>;
  getRunnerSessionByWorkspaceId(workspaceId: string): MaybePromise<RunnerSession | undefined>;
}

@Injectable()
export class InMemoryTasksRepository implements TasksRepository {
  private readonly tasks = new Map<string, Task>();
  private readonly events = new Map<string, AgentFlowEvent[]>();
  private readonly artifacts = new Map<string, Artifact[]>();
  private readonly approvals = new Map<string, Approval[]>();
  private readonly taskSources = new Map<string, TaskSource>();
  private readonly contextSnapshots = new Map<string, ContextSnapshot>();
  private readonly patchLifecycles = new Map<string, PatchLifecycle>();
  private readonly commandRuns = new Map<string, CommandRun[]>();
  private readonly previewSessions = new Map<string, PreviewSession>();
  private readonly auditEvents: AuditEvent[] = [];
  private readonly workspaces = new Map<string, Workspace>();
  private readonly runnerSessions = new Map<string, RunnerSession>();

  createTask(task: Task): Task {
    this.tasks.set(task.id, task);
    this.events.set(task.id, []);
    this.artifacts.set(task.id, []);
    this.approvals.set(task.id, []);
    this.commandRuns.set(task.id, []);

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

  updateArtifact(artifact: Artifact): Artifact {
    const artifacts = this.artifacts.get(artifact.taskId) ?? [];
    const index = artifacts.findIndex((currentArtifact) => currentArtifact.id === artifact.id);

    if (index >= 0) {
      artifacts[index] = artifact;
    }

    return artifact;
  }

  listArtifacts(taskId: string): Artifact[] {
    return this.artifacts.get(taskId) ?? [];
  }

  addApproval(approval: Approval): Approval {
    this.approvals.get(approval.taskId)?.push(approval);

    return approval;
  }

  updateApproval(approval: Approval): Approval {
    const approvals = this.approvals.get(approval.taskId) ?? [];
    const index = approvals.findIndex((currentApproval) => currentApproval.id === approval.id);

    if (index >= 0) {
      approvals[index] = approval;
    }

    return approval;
  }

  getApproval(approvalId: string): Approval | undefined {
    return Array.from(this.approvals.values())
      .flat()
      .find((approval) => approval.id === approvalId);
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

  setContextSnapshot(snapshot: ContextSnapshot): ContextSnapshot {
    this.contextSnapshots.set(snapshot.taskId, snapshot);

    return snapshot;
  }

  getContextSnapshot(taskId: string): ContextSnapshot | undefined {
    return this.contextSnapshots.get(taskId);
  }

  setPatchLifecycle(lifecycle: PatchLifecycle): PatchLifecycle {
    this.patchLifecycles.set(lifecycle.taskId, lifecycle);

    return lifecycle;
  }

  getPatchLifecycle(taskId: string): PatchLifecycle | undefined {
    return this.patchLifecycles.get(taskId);
  }

  setCommandRun(commandRun: CommandRun): CommandRun {
    const commandRuns = this.commandRuns.get(commandRun.taskId) ?? [];
    const index = commandRuns.findIndex((currentRun) => currentRun.id === commandRun.id);

    if (index >= 0) {
      commandRuns[index] = commandRun;
    } else {
      commandRuns.push(commandRun);
    }

    this.commandRuns.set(commandRun.taskId, commandRuns);

    return commandRun;
  }

  listCommandRuns(taskId: string): CommandRun[] {
    return this.commandRuns.get(taskId) ?? [];
  }

  setPreviewSession(previewSession: PreviewSession): PreviewSession {
    this.previewSessions.set(previewSession.taskId, previewSession);

    return previewSession;
  }

  getPreviewSessionByTaskId(taskId: string): PreviewSession | undefined {
    return this.previewSessions.get(taskId);
  }

  getActivePreviewSessionByWorkspaceId(workspaceId: string): PreviewSession | undefined {
    return Array.from(this.previewSessions.values())
      .filter(
        (previewSession) =>
          previewSession.workspaceId === workspaceId &&
          (previewSession.status === "starting" || previewSession.status === "running"),
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
  }

  registerRunner(input: RegisterRunnerInput): { workspace: Workspace; session: RunnerSession } {
    const workspaceId = createWorkspaceId(input.workspaceRoot);
    const sessionId = createRunnerSessionId(input.runnerId);
    const now = input.createdAt;
    const existingWorkspace = this.workspaces.get(workspaceId);
    const workspace: Workspace = {
      id: workspaceId,
      name: input.workspaceName?.trim() || path.basename(input.workspaceRoot),
      rootPath: path.resolve(input.workspaceRoot),
      status: "online",
      runnerMode: "local",
      runnerId: input.runnerId,
      branch: input.branch,
      lastHeartbeatAt: now,
      createdAt: existingWorkspace?.createdAt ?? now,
      updatedAt: now,
    };
    const existingSession = this.runnerSessions.get(sessionId);
    const session: RunnerSession = {
      id: sessionId,
      runnerId: input.runnerId,
      workspaceId,
      workspaceRoot: workspace.rootPath,
      status: "online",
      protocolVersion: input.protocolVersion,
      capabilities: [...input.capabilities],
      controlBaseUrl: input.controlBaseUrl,
      controlToken: input.controlToken,
      connectedAt: existingSession?.connectedAt ?? now,
      lastHeartbeatAt: now,
      disconnectedAt: undefined,
    };

    this.workspaces.set(workspaceId, workspace);
    this.runnerSessions.set(sessionId, session);

    return { workspace, session };
  }

  heartbeatRunner(input: HeartbeatRunnerInput): { workspace: Workspace; session: RunnerSession } | undefined {
    const sessionId = createRunnerSessionId(input.runnerId);
    const session = this.runnerSessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    const workspace = this.workspaces.get(session.workspaceId);

    if (!workspace) {
      return undefined;
    }

    const nextStatus = input.status === "busy" ? "indexing" : input.status === "offline" ? "offline" : "online";
    const updatedSession: RunnerSession = {
      ...session,
      workspaceRoot: path.resolve(input.workspaceRoot),
      status: input.status,
      lastHeartbeatAt: input.sentAt,
      disconnectedAt: input.status === "offline" ? input.sentAt : undefined,
    };
    const updatedWorkspace: Workspace = {
      ...workspace,
      runnerId: input.runnerId,
      rootPath: path.resolve(input.workspaceRoot),
      status: nextStatus,
      lastHeartbeatAt: input.sentAt,
      updatedAt: input.sentAt,
    };

    this.runnerSessions.set(sessionId, updatedSession);
    this.workspaces.set(workspace.id, updatedWorkspace);

    return {
      workspace: updatedWorkspace,
      session: updatedSession,
    };
  }

  listWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  listRunnerSessions(): RunnerSession[] {
    return Array.from(this.runnerSessions.values());
  }

  getRunnerSessionByWorkspaceId(workspaceId: string): RunnerSession | undefined {
    return Array.from(this.runnerSessions.values()).find((session) => session.workspaceId === workspaceId);
  }
}

function createWorkspaceId(workspaceRoot: string): string {
  return `workspace_${sanitizePathSegment(path.resolve(workspaceRoot))}`;
}

function createRunnerSessionId(runnerId: string): string {
  return `session_${sanitizePathSegment(runnerId)}`;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
