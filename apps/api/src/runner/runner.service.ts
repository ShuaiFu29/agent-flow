import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  RunnerControlMessage,
  RunnerHeartbeatResponse,
  RunnerRegisterResponse,
  RunnerSession,
  Workspace,
} from "@agent-flow/shared";
import { TASKS_REPOSITORY, type TasksRepository } from "../tasks/tasks.repository";

const RUNNER_TTL_MS = 15_000;

@Injectable()
export class RunnerService {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly tasksRepository: TasksRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async register(
    message: Extract<RunnerControlMessage, { type: "runner_register" }>,
  ): Promise<RunnerRegisterResponse> {
    const { workspace, session } = await this.tasksRepository.registerRunner({
      runnerId: message.runnerId,
      workspaceRoot: message.workspaceRoot,
      workspaceName: message.workspaceName,
      branch: message.branch,
      controlBaseUrl: message.controlBaseUrl,
      controlToken: message.controlToken,
      protocolVersion: message.protocolVersion,
      capabilities: message.capabilities,
      createdAt: message.createdAt,
    });

    return {
      accepted: true,
      workspaceId: workspace.id,
      sessionId: session.id,
      status: "online",
      message: "Runner registered.",
      receivedAt: this.now(),
    };
  }

  async heartbeat(
    message: Extract<RunnerControlMessage, { type: "runner_heartbeat" }>,
  ): Promise<RunnerHeartbeatResponse> {
    const result = await this.tasksRepository.heartbeatRunner({
      runnerId: message.runnerId,
      workspaceRoot: message.workspaceRoot,
      status: message.status,
      sentAt: message.sentAt,
    });

    if (!result) {
      throw new NotFoundException(`Runner ${message.runnerId} is not registered.`);
    }

    return {
      accepted: true,
      workspaceId: result.workspace.id,
      sessionId: result.session.id,
      status: result.session.status === "busy" ? "busy" : "online",
      message: "Heartbeat accepted.",
      receivedAt: this.now(),
    };
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return (await this.tasksRepository.listWorkspaces()).map((workspace) => this.withWorkspaceStatus(workspace));
  }

  async listRunnerSessions(): Promise<RunnerSession[]> {
    return (await this.tasksRepository.listRunnerSessions()).map((session) => this.withSessionStatus(session));
  }

  async getOnlineSessionForWorkspace(workspaceId: string): Promise<RunnerSession | undefined> {
    const session = await this.tasksRepository.getRunnerSessionByWorkspaceId(workspaceId);

    if (!session) {
      return undefined;
    }

    const nextSession = this.withSessionStatus(session);

    return nextSession.status === "offline" ? undefined : nextSession;
  }

  private withWorkspaceStatus(workspace: Workspace): Workspace {
    if (!workspace.lastHeartbeatAt) {
      return workspace;
    }

    const stale = this.isStale(workspace.lastHeartbeatAt);
    if (!stale) {
      return workspace;
    }

    return {
      ...workspace,
      status: "offline",
    };
  }

  private withSessionStatus(session: RunnerSession): RunnerSession {
    if (!this.isStale(session.lastHeartbeatAt)) {
      return session;
    }

    return {
      ...session,
      status: "offline",
    };
  }

  private isStale(lastHeartbeatAt: string): boolean {
    return new Date(this.now()).getTime() - new Date(lastHeartbeatAt).getTime() > RUNNER_TTL_MS;
  }
}
