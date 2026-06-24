import path from "node:path";
import type { PrismaClient } from "@agent-flow/db";
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
  RunnerSession,
  Task,
  TaskSource,
  Workspace,
} from "@agent-flow/shared";
import type { HeartbeatRunnerInput, RegisterRunnerInput, TasksRepository } from "./tasks.repository";

@Injectable()
export class PrismaTasksRepository implements TasksRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createTask(task: Task): Promise<Task> {
    const createdTask = await this.prisma.task.create({
      data: toTaskCreateInput(task),
    });

    return mapTask(createdTask);
  }

  async updateTask(task: Task): Promise<Task> {
    const updatedTask = await this.prisma.task.update({
      where: { id: task.id },
      data: toTaskUpdateInput(task),
    });

    return mapTask(updatedTask);
  }

  async listTasks(): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return tasks.map(mapTask);
  }

  async getTask(taskId: string): Promise<Task | undefined> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    return task ? mapTask(task) : undefined;
  }

  async addEvent(event: AgentFlowEvent): Promise<AgentFlowEvent> {
    const createdEvent = await this.prisma.event.create({
      data: {
        id: event.id,
        taskId: event.taskId,
        type: event.type,
        agentRole: event.agentRole,
        message: event.message,
        payload: null,
        createdAt: new Date(event.createdAt),
      },
    });

    return mapEvent(createdEvent);
  }

  async listEvents(taskId: string): Promise<AgentFlowEvent[]> {
    const events = await this.prisma.event.findMany({
      where: { taskId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return events.map(mapEvent);
  }

  async addArtifact(artifact: Artifact): Promise<Artifact> {
    const createdArtifact = await this.prisma.artifact.create({
      data: {
        id: artifact.id,
        taskId: artifact.taskId,
        kind: artifact.kind,
        title: artifact.title,
        content: artifact.content,
        createdAt: new Date(artifact.createdAt),
      },
    });

    return mapArtifact(createdArtifact);
  }

  async updateArtifact(artifact: Artifact): Promise<Artifact> {
    const updatedArtifact = await this.prisma.artifact.update({
      where: { id: artifact.id },
      data: {
        kind: artifact.kind,
        title: artifact.title,
        content: artifact.content,
      },
    });

    return mapArtifact(updatedArtifact);
  }

  async listArtifacts(taskId: string): Promise<Artifact[]> {
    const artifacts = await this.prisma.artifact.findMany({
      where: { taskId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return artifacts.map(mapArtifact);
  }

  async addApproval(approval: Approval): Promise<Approval> {
    const createdApproval = await this.prisma.approval.create({
      data: {
        id: approval.id,
        taskId: approval.taskId,
        kind: approval.kind,
        status: approval.status,
        payload: JSON.stringify(approval.payload),
        createdAt: new Date(approval.createdAt),
        decidedAt: approval.decidedAt ? new Date(approval.decidedAt) : null,
      },
    });

    return mapApproval(createdApproval);
  }

  async updateApproval(approval: Approval): Promise<Approval> {
    const updatedApproval = await this.prisma.approval.update({
      where: { id: approval.id },
      data: {
        kind: approval.kind,
        status: approval.status,
        payload: JSON.stringify(approval.payload),
        decidedAt: approval.decidedAt ? new Date(approval.decidedAt) : null,
      },
    });

    return mapApproval(updatedApproval);
  }

  async getApproval(approvalId: string): Promise<Approval | undefined> {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
    });

    return approval ? mapApproval(approval) : undefined;
  }

  async listApprovals(taskId?: string): Promise<Approval[]> {
    const approvals = await this.prisma.approval.findMany({
      where: taskId ? { taskId } : undefined,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return approvals.map(mapApproval);
  }

  async addAuditEvent(event: AuditEvent): Promise<AuditEvent> {
    const createdAuditEvent = await this.prisma.auditEvent.create({
      data: {
        id: event.id,
        taskId: event.taskId ?? null,
        workspaceId: event.workspaceId ?? null,
        source: event.source,
        action: event.action,
        message: event.message,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        createdAt: new Date(event.createdAt),
      },
    });

    return mapAuditEvent(createdAuditEvent);
  }

  async listAuditEvents(taskId?: string): Promise<AuditEvent[]> {
    const auditEvents = await this.prisma.auditEvent.findMany({
      where: taskId ? { taskId } : undefined,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return auditEvents.map(mapAuditEvent);
  }

  async setTaskSource(source: TaskSource): Promise<TaskSource> {
    const taskSource = await this.prisma.taskSource.upsert({
      where: { taskId: source.taskId },
      update: {
        kind: source.kind,
        title: source.title,
        content: source.content,
        url: source.url ?? null,
      },
      create: {
        id: source.id,
        taskId: source.taskId,
        kind: source.kind,
        title: source.title,
        content: source.content,
        url: source.url ?? null,
        createdAt: new Date(source.createdAt),
      },
    });

    return mapTaskSource(taskSource);
  }

  async getTaskSource(taskId: string): Promise<TaskSource | undefined> {
    const source = await this.prisma.taskSource.findUnique({
      where: { taskId },
    });

    return source ? mapTaskSource(source) : undefined;
  }

  async setContextSnapshot(snapshot: ContextSnapshot): Promise<ContextSnapshot> {
    const createdSnapshot = await this.prisma.contextSnapshot.upsert({
      where: { taskId: snapshot.taskId },
      update: {
        selectedFiles: JSON.stringify(snapshot.selectedFiles),
        rejectedFiles: JSON.stringify(snapshot.rejectedFiles),
      },
      create: {
        id: snapshot.id,
        taskId: snapshot.taskId,
        selectedFiles: JSON.stringify(snapshot.selectedFiles),
        rejectedFiles: JSON.stringify(snapshot.rejectedFiles),
        createdAt: new Date(snapshot.createdAt),
      },
    });

    return mapContextSnapshot(createdSnapshot);
  }

  async getContextSnapshot(taskId: string): Promise<ContextSnapshot | undefined> {
    const snapshot = await this.prisma.contextSnapshot.findUnique({
      where: { taskId },
    });

    return snapshot ? mapContextSnapshot(snapshot) : undefined;
  }

  async setPatchLifecycle(lifecycle: PatchLifecycle): Promise<PatchLifecycle> {
    const record = await this.prisma.patchLifecycle.upsert({
      where: { taskId: lifecycle.taskId },
      update: {
        patchArtifactId: lifecycle.patchArtifactId,
        approvalId: lifecycle.approvalId ?? null,
        status: lifecycle.status,
        precheck: JSON.stringify(lifecycle.precheck),
        applyResult: lifecycle.applyResult ? JSON.stringify(lifecycle.applyResult) : null,
        updatedAt: new Date(lifecycle.updatedAt),
      },
      create: {
        id: lifecycle.id,
        taskId: lifecycle.taskId,
        patchArtifactId: lifecycle.patchArtifactId,
        approvalId: lifecycle.approvalId ?? null,
        status: lifecycle.status,
        precheck: JSON.stringify(lifecycle.precheck),
        applyResult: lifecycle.applyResult ? JSON.stringify(lifecycle.applyResult) : null,
        createdAt: new Date(lifecycle.createdAt),
        updatedAt: new Date(lifecycle.updatedAt),
      },
    });

    return mapPatchLifecycle(record);
  }

  async getPatchLifecycle(taskId: string): Promise<PatchLifecycle | undefined> {
    const lifecycle = await this.prisma.patchLifecycle.findUnique({
      where: { taskId },
    });

    return lifecycle ? mapPatchLifecycle(lifecycle) : undefined;
  }

  async setCommandRun(commandRun: CommandRun): Promise<CommandRun> {
    const record = await this.prisma.commandRun.upsert({
      where: { id: commandRun.id },
      update: {
        taskId: commandRun.taskId,
        approvalId: commandRun.approvalId ?? null,
        command: commandRun.command,
        status: commandRun.status,
        exitCode: commandRun.exitCode ?? null,
        stdout: commandRun.stdout ?? null,
        stderr: commandRun.stderr ?? null,
        startedAt: commandRun.startedAt ? new Date(commandRun.startedAt) : null,
        completedAt: commandRun.completedAt ? new Date(commandRun.completedAt) : null,
        outputArtifactId: commandRun.outputArtifactId ?? null,
        createdAt: commandRun.createdAt ? new Date(commandRun.createdAt) : undefined,
        updatedAt: commandRun.updatedAt ? new Date(commandRun.updatedAt) : undefined,
      },
      create: {
        id: commandRun.id,
        taskId: commandRun.taskId,
        approvalId: commandRun.approvalId ?? null,
        command: commandRun.command,
        status: commandRun.status,
        exitCode: commandRun.exitCode ?? null,
        stdout: commandRun.stdout ?? null,
        stderr: commandRun.stderr ?? null,
        startedAt: commandRun.startedAt ? new Date(commandRun.startedAt) : null,
        completedAt: commandRun.completedAt ? new Date(commandRun.completedAt) : null,
        outputArtifactId: commandRun.outputArtifactId ?? null,
        createdAt: commandRun.createdAt ? new Date(commandRun.createdAt) : undefined,
        updatedAt: commandRun.updatedAt ? new Date(commandRun.updatedAt) : undefined,
      },
    });

    return mapCommandRun(record);
  }

  async listCommandRuns(taskId: string): Promise<CommandRun[]> {
    const commandRuns = await this.prisma.commandRun.findMany({
      where: { taskId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return commandRuns.map(mapCommandRun);
  }

  async setPreviewSession(previewSession: PreviewSession): Promise<PreviewSession> {
    const record = await this.prisma.previewSession.upsert({
      where: { taskId: previewSession.taskId },
      update: {
        workspaceId: previewSession.workspaceId,
        status: previewSession.status,
        url: previewSession.url,
        port: previewSession.port,
        command: previewSession.command,
        startedAt: new Date(previewSession.startedAt),
        stoppedAt: previewSession.stoppedAt ? new Date(previewSession.stoppedAt) : null,
        lastHeartbeatAt: previewSession.lastHeartbeatAt ? new Date(previewSession.lastHeartbeatAt) : null,
        failureMessage: previewSession.failureMessage ?? null,
      },
      create: {
        id: previewSession.id,
        taskId: previewSession.taskId,
        workspaceId: previewSession.workspaceId,
        status: previewSession.status,
        url: previewSession.url,
        port: previewSession.port,
        command: previewSession.command,
        startedAt: new Date(previewSession.startedAt),
        stoppedAt: previewSession.stoppedAt ? new Date(previewSession.stoppedAt) : null,
        lastHeartbeatAt: previewSession.lastHeartbeatAt ? new Date(previewSession.lastHeartbeatAt) : null,
        failureMessage: previewSession.failureMessage ?? null,
      },
    });

    return mapPreviewSession(record);
  }

  async getPreviewSessionByTaskId(taskId: string): Promise<PreviewSession | undefined> {
    const previewSession = await this.prisma.previewSession.findUnique({
      where: { taskId },
    });

    return previewSession ? mapPreviewSession(previewSession) : undefined;
  }

  async getActivePreviewSessionByWorkspaceId(workspaceId: string): Promise<PreviewSession | undefined> {
    const previewSession = await this.prisma.previewSession.findFirst({
      where: {
        workspaceId,
        status: {
          in: ["starting", "running"],
        },
      },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    });

    return previewSession ? mapPreviewSession(previewSession) : undefined;
  }

  async registerRunner(input: RegisterRunnerInput): Promise<{ workspace: Workspace; session: RunnerSession }> {
    const workspaceRoot = path.resolve(input.workspaceRoot);
    const workspaceId = createWorkspaceId(workspaceRoot);
    const sessionId = createRunnerSessionId(input.runnerId);
    const existingWorkspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    const existingSession = await this.prisma.runnerSession.findUnique({
      where: { id: sessionId },
    });

    const workspace = await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {
        name: input.workspaceName?.trim() || workspaceId,
        rootPath: workspaceRoot,
        status: "online",
        runnerMode: "local",
        runnerId: input.runnerId,
        branch: input.branch ?? null,
        lastHeartbeatAt: new Date(input.createdAt),
      },
      create: {
        id: workspaceId,
        name: input.workspaceName?.trim() || workspaceId,
        rootPath: workspaceRoot,
        status: "online",
        runnerMode: "local",
        runnerId: input.runnerId,
        branch: input.branch ?? null,
        lastHeartbeatAt: new Date(input.createdAt),
        createdAt: existingWorkspace ? new Date(existingWorkspace.createdAt) : new Date(input.createdAt),
      },
    });

    const session = await this.prisma.runnerSession.upsert({
      where: { id: sessionId },
      update: {
        runnerId: input.runnerId,
        workspaceId,
        workspaceRoot,
        status: "online",
        protocolVersion: input.protocolVersion,
        capabilities: JSON.stringify(input.capabilities),
        controlBaseUrl: input.controlBaseUrl,
        controlToken: input.controlToken,
        lastHeartbeatAt: new Date(input.createdAt),
        disconnectedAt: null,
      },
      create: {
        id: sessionId,
        runnerId: input.runnerId,
        workspaceId,
        workspaceRoot,
        status: "online",
        protocolVersion: input.protocolVersion,
        capabilities: JSON.stringify(input.capabilities),
        controlBaseUrl: input.controlBaseUrl,
        controlToken: input.controlToken,
        connectedAt: existingSession ? new Date(existingSession.connectedAt) : new Date(input.createdAt),
        lastHeartbeatAt: new Date(input.createdAt),
      },
    });

    return {
      workspace: mapWorkspace(workspace),
      session: mapRunnerSession(session),
    };
  }

  async heartbeatRunner(
    input: HeartbeatRunnerInput,
  ): Promise<{ workspace: Workspace; session: RunnerSession } | undefined> {
    const workspaceRoot = path.resolve(input.workspaceRoot);
    const sessionId = createRunnerSessionId(input.runnerId);
    const session = await this.prisma.runnerSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return undefined;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: session.workspaceId },
    });

    if (!workspace) {
      return undefined;
    }

    const workspaceStatus = input.status === "busy" ? "indexing" : input.status === "offline" ? "offline" : "online";
    const updatedSession = await this.prisma.runnerSession.update({
      where: { id: sessionId },
      data: {
        workspaceRoot,
        status: input.status,
        lastHeartbeatAt: new Date(input.sentAt),
        disconnectedAt: input.status === "offline" ? new Date(input.sentAt) : null,
      },
    });
    const updatedWorkspace = await this.prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        runnerId: input.runnerId,
        rootPath: workspaceRoot,
        status: workspaceStatus,
        lastHeartbeatAt: new Date(input.sentAt),
      },
    });

    return {
      workspace: mapWorkspace(updatedWorkspace),
      session: mapRunnerSession(updatedSession),
    };
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const workspaces = await this.prisma.workspace.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return workspaces.map(mapWorkspace);
  }

  async listRunnerSessions(): Promise<RunnerSession[]> {
    const sessions = await this.prisma.runnerSession.findMany({
      orderBy: [{ connectedAt: "asc" }, { id: "asc" }],
    });

    return sessions.map(mapRunnerSession);
  }

  async getRunnerSessionByWorkspaceId(workspaceId: string): Promise<RunnerSession | undefined> {
    const session = await this.prisma.runnerSession.findFirst({
      where: { workspaceId },
      orderBy: [{ connectedAt: "desc" }, { id: "desc" }],
    });

    return session ? mapRunnerSession(session) : undefined;
  }
}

function toTaskCreateInput(task: Task) {
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    status: task.status,
    workspace: task.workspaceId
      ? {
          connect: { id: task.workspaceId },
        }
      : undefined,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
  };
}

function toTaskUpdateInput(task: Task) {
  return {
    title: task.title,
    prompt: task.prompt,
    status: task.status,
    workspace: task.workspaceId
      ? {
          connect: { id: task.workspaceId },
        }
      : {
          disconnect: true,
        },
    updatedAt: new Date(task.updatedAt),
  };
}

function mapTask(task: {
  id: string;
  title: string;
  prompt: string;
  workspaceId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Task {
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    workspaceId: task.workspaceId ?? undefined,
    status: task.status as Task["status"],
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function mapEvent(event: {
  id: string;
  taskId: string;
  type: string;
  agentRole: string | null;
  message: string;
  createdAt: Date;
}): AgentFlowEvent {
  return {
    id: event.id,
    taskId: event.taskId,
    type: event.type as AgentFlowEvent["type"],
    agentRole: event.agentRole as AgentFlowEvent["agentRole"],
    message: event.message,
    createdAt: event.createdAt.toISOString(),
  };
}

function mapArtifact(artifact: {
  id: string;
  taskId: string;
  kind: string;
  title: string;
  content: string;
  createdAt: Date;
}): Artifact {
  return {
    id: artifact.id,
    taskId: artifact.taskId,
    kind: artifact.kind as Artifact["kind"],
    title: artifact.title,
    content: artifact.content,
    createdAt: artifact.createdAt.toISOString(),
  };
}

function mapApproval(approval: {
  id: string;
  taskId: string;
  kind: string;
  status: string;
  payload: string;
  createdAt: Date;
  decidedAt: Date | null;
}): Approval {
  return {
    id: approval.id,
    taskId: approval.taskId,
    kind: approval.kind as Approval["kind"],
    status: approval.status as Approval["status"],
    payload: JSON.parse(approval.payload) as Record<string, unknown>,
    createdAt: approval.createdAt.toISOString(),
    decidedAt: approval.decidedAt?.toISOString(),
  };
}

function mapAuditEvent(event: {
  id: string;
  taskId: string | null;
  workspaceId: string | null;
  source: string;
  action: string;
  message: string;
  metadata: string | null;
  createdAt: Date;
}): AuditEvent {
  return {
    id: event.id,
    taskId: event.taskId ?? undefined,
    workspaceId: event.workspaceId ?? undefined,
    source: event.source as AuditEvent["source"],
    action: event.action,
    message: event.message,
    metadata: event.metadata ? (JSON.parse(event.metadata) as Record<string, unknown>) : undefined,
    createdAt: event.createdAt.toISOString(),
  };
}

function mapTaskSource(source: {
  id: string;
  taskId: string;
  kind: string;
  title: string;
  content: string;
  url: string | null;
  createdAt: Date;
}): TaskSource {
  return {
    id: source.id,
    taskId: source.taskId,
    kind: source.kind as TaskSource["kind"],
    title: source.title,
    content: source.content,
    url: source.url ?? undefined,
    createdAt: source.createdAt.toISOString(),
  };
}

function mapContextSnapshot(snapshot: {
  id: string;
  taskId: string;
  selectedFiles: string;
  rejectedFiles: string;
  createdAt: Date;
}): ContextSnapshot {
  return {
    id: snapshot.id,
    taskId: snapshot.taskId,
    selectedFiles: JSON.parse(snapshot.selectedFiles) as ContextSnapshot["selectedFiles"],
    rejectedFiles: JSON.parse(snapshot.rejectedFiles) as ContextSnapshot["rejectedFiles"],
    createdAt: snapshot.createdAt.toISOString(),
  };
}

function mapPatchLifecycle(lifecycle: {
  id: string;
  taskId: string;
  patchArtifactId: string;
  approvalId: string | null;
  status: string;
  precheck: string;
  applyResult: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PatchLifecycle {
  return {
    id: lifecycle.id,
    taskId: lifecycle.taskId,
    patchArtifactId: lifecycle.patchArtifactId,
    approvalId: lifecycle.approvalId ?? undefined,
    status: lifecycle.status as PatchLifecycle["status"],
    precheck: JSON.parse(lifecycle.precheck) as PatchLifecycle["precheck"],
    applyResult: lifecycle.applyResult
      ? (JSON.parse(lifecycle.applyResult) as PatchLifecycle["applyResult"])
      : undefined,
    createdAt: lifecycle.createdAt.toISOString(),
    updatedAt: lifecycle.updatedAt.toISOString(),
  };
}

function mapCommandRun(commandRun: {
  id: string;
  taskId: string;
  approvalId: string | null;
  command: string;
  status: string;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  outputArtifactId: string | null;
}): CommandRun {
  return {
    id: commandRun.id,
    taskId: commandRun.taskId,
    approvalId: commandRun.approvalId ?? undefined,
    command: commandRun.command,
    status: commandRun.status as CommandRun["status"],
    exitCode: commandRun.exitCode ?? undefined,
    stdout: commandRun.stdout ?? undefined,
    stderr: commandRun.stderr ?? undefined,
    createdAt: commandRun.createdAt.toISOString(),
    updatedAt: commandRun.updatedAt.toISOString(),
    startedAt: commandRun.startedAt?.toISOString(),
    completedAt: commandRun.completedAt?.toISOString(),
    outputArtifactId: commandRun.outputArtifactId ?? undefined,
  };
}

function mapPreviewSession(previewSession: {
  id: string;
  taskId: string;
  workspaceId: string;
  status: string;
  url: string;
  port: number;
  command: string;
  startedAt: Date;
  stoppedAt: Date | null;
  lastHeartbeatAt: Date | null;
  failureMessage: string | null;
}): PreviewSession {
  return {
    id: previewSession.id,
    taskId: previewSession.taskId,
    workspaceId: previewSession.workspaceId,
    status: previewSession.status as PreviewSession["status"],
    url: previewSession.url,
    port: previewSession.port,
    command: previewSession.command,
    startedAt: previewSession.startedAt.toISOString(),
    stoppedAt: previewSession.stoppedAt?.toISOString(),
    lastHeartbeatAt: previewSession.lastHeartbeatAt?.toISOString(),
    failureMessage: previewSession.failureMessage ?? undefined,
  };
}

function mapWorkspace(workspace: {
  id: string;
  name: string;
  rootPath: string;
  status: string;
  runnerMode: string;
  runnerId: string | null;
  branch: string | null;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    rootPath: workspace.rootPath,
    status: workspace.status as Workspace["status"],
    runnerMode: workspace.runnerMode as Workspace["runnerMode"],
    runnerId: workspace.runnerId ?? undefined,
    branch: workspace.branch ?? undefined,
    lastHeartbeatAt: workspace.lastHeartbeatAt?.toISOString(),
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

function mapRunnerSession(session: {
  id: string;
  runnerId: string;
  workspaceId: string;
  workspaceRoot: string;
  status: string;
  protocolVersion: string;
  capabilities: string;
  controlBaseUrl: string;
  controlToken: string;
  connectedAt: Date;
  lastHeartbeatAt: Date;
  disconnectedAt: Date | null;
}): RunnerSession {
  return {
    id: session.id,
    runnerId: session.runnerId,
    workspaceId: session.workspaceId,
    workspaceRoot: session.workspaceRoot,
    status: session.status as RunnerSession["status"],
    protocolVersion: session.protocolVersion as RunnerSession["protocolVersion"],
    capabilities: JSON.parse(session.capabilities) as string[],
    controlBaseUrl: session.controlBaseUrl,
    controlToken: session.controlToken,
    connectedAt: session.connectedAt.toISOString(),
    lastHeartbeatAt: session.lastHeartbeatAt.toISOString(),
    disconnectedAt: session.disconnectedAt?.toISOString(),
  };
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
