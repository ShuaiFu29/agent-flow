import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { from, map, mergeMap } from "rxjs";
import type {
  AgentFlowEvent,
  AgentRole,
  Approval,
  Artifact,
  ArtifactKind,
  AuditEvent,
  Task,
  TaskSource,
  Workspace,
} from "@agent-flow/shared";
import { RunnerContextClient } from "../context/runner-context.client";
import { WorkspaceContextService } from "../context/workspace-context.service";
import { RunnerService } from "../runner/runner.service";
import { ArtifactGenerator } from "./artifact-generator";
import { TASKS_REPOSITORY, type TasksRepository } from "./tasks.repository";

type CreateTaskInput = {
  title: string;
  prompt: string;
};

type RunnerExecutionClient = Pick<RunnerContextClient, "applyPatch" | "runCommand">;

@Injectable()
export class TasksService {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly tasksRepository: TasksRepository,
    @Inject(WorkspaceContextService)
    private readonly workspaceContextService: WorkspaceContextService,
    @Inject(ArtifactGenerator)
    private readonly artifactGenerator: ArtifactGenerator,
    @Inject(RunnerService)
    private readonly runnerService: RunnerService,
    @Inject(RunnerContextClient)
    private readonly runnerExecutionClient: RunnerExecutionClient,
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const workspace = await this.getDefaultWorkspace();
    const task: Task = {
      id: createId("task"),
      title: input.title,
      prompt: input.prompt,
      workspaceId: workspace.id,
      status: "running",
      createdAt: now,
      updatedAt: now,
    };

    await this.tasksRepository.createTask(task);
    await this.tasksRepository.setTaskSource({
      id: createId("source"),
      taskId: task.id,
      kind: "manual",
      title: input.title,
      content: input.prompt,
      createdAt: now,
    });

    await this.addEvent(task.id, "task_created", "任务已创建");
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "user",
      action: "task_created",
      message: `用户创建任务：${input.title}`,
      metadata: { workspaceId: workspace.id },
    });

    try {
      return await this.runContextBackedWorkflow(task, workspace);
    } catch (error) {
      return await this.failTask(task, workspace, error instanceof Error ? error.message : "Unknown task failure");
    }
  }

  async listTasks(): Promise<Task[]> {
    return await this.tasksRepository.listTasks();
  }

  async getTask(taskId: string): Promise<Task> {
    const task = await this.tasksRepository.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} was not found.`);
    }

    return task;
  }

  async listEvents(taskId: string): Promise<AgentFlowEvent[]> {
    await this.getTask(taskId);

    return await this.tasksRepository.listEvents(taskId);
  }

  async listArtifacts(taskId: string): Promise<Artifact[]> {
    await this.getTask(taskId);

    return await this.tasksRepository.listArtifacts(taskId);
  }

  async listApprovals(taskId?: string): Promise<Approval[]> {
    if (taskId) {
      await this.getTask(taskId);
    }

    return await this.tasksRepository.listApprovals(taskId);
  }

  async listAuditEvents(taskId?: string): Promise<AuditEvent[]> {
    if (taskId) {
      await this.getTask(taskId);
    }

    return await this.tasksRepository.listAuditEvents(taskId);
  }

  async getTaskSource(taskId: string): Promise<TaskSource> {
    await this.getTask(taskId);
    const source = await this.tasksRepository.getTaskSource(taskId);

    if (!source) {
      throw new NotFoundException(`Task source for ${taskId} was not found.`);
    }

    return source;
  }

  async approveApproval(approvalId: string): Promise<Approval> {
    const approval = await this.getApprovalOrThrow(approvalId);
    const task = await this.getTask(approval.taskId);
    const workspace = await this.getWorkspaceForTask(task);
    const session = await this.getRunnerSessionForTask(task);

    const approved: Approval = {
      ...approval,
      status: "approved",
      decidedAt: new Date().toISOString(),
    };
    await this.tasksRepository.updateApproval(approved);
    await this.addEvent(task.id, "approval_granted", `${approval.kind} 已批准`);
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "user",
      action: "approval_granted",
      message: `用户批准 ${approval.kind}`,
      metadata: { approvalId: approval.id, kind: approval.kind },
    });

    try {
      if (approval.kind === "apply_patch") {
        await this.executePatchApproval(task, workspace, session, approved);
      } else {
        await this.executeCommandApproval(task, workspace, session, approved);
      }
    } catch (error) {
      await this.failTask(task, workspace, error instanceof Error ? error.message : "Approval execution failed");
    }

    return approved;
  }

  async rejectApproval(approvalId: string): Promise<Approval> {
    const approval = await this.getApprovalOrThrow(approvalId);
    const task = await this.getTask(approval.taskId);
    const workspace = await this.getWorkspaceForTask(task);
    const rejected: Approval = {
      ...approval,
      status: "rejected",
      decidedAt: new Date().toISOString(),
    };

    await this.tasksRepository.updateApproval(rejected);
    await this.addEvent(task.id, "approval_rejected", `${approval.kind} 已拒绝`);
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "user",
      action: "approval_rejected",
      message: `用户拒绝 ${approval.kind}`,
      metadata: { approvalId: approval.id, kind: approval.kind },
    });
    await this.updateFinalReport(
      task.id,
      [
        `任务《${task.title}》在审批阶段被拒绝。`,
        "当前任务状态：failed",
        `被拒绝审批：${approval.kind}`,
      ].join("\n"),
    );

    await this.failTask(task, workspace, `Approval rejected: ${approval.kind}`, false);
    return rejected;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return await this.tasksRepository.listWorkspaces();
  }

  streamEvents(taskId: string): Observable<MessageEvent> {
    return from(this.listEvents(taskId)).pipe(
      mergeMap((events) => from(events)),
      map((event) => ({ data: event })),
    );
  }

  private async runContextBackedWorkflow(task: Task, workspace: Workspace): Promise<Task> {
    const context = await this.workspaceContextService.collect(workspace);
    const artifacts = this.artifactGenerator.generate({
      taskTitle: task.title,
      prompt: task.prompt,
      workspaceName: workspace.name,
      context,
    });

    await this.completeAgentStep(task.id, "context", artifacts.workspaceSummary);
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "agent",
      action: "context_snapshot_created",
      message: `已从 ${workspace.name} 采集真实上下文并生成摘要`,
      metadata: {
        workspaceId: workspace.id,
        branch: context.branch,
        keyFiles: context.keyFiles.map((file) => file.path),
      },
    });

    await this.completeAgentStep(task.id, "planner", artifacts.plan);
    const patchArtifact = await this.completeAgentStep(task.id, "coder", artifacts.patch);
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "agent",
      action: "patch_created",
      message: "编码 Agent 已生成基于真实上下文的 patch proposal",
      metadata: { files: context.keyFiles.slice(0, 3).map((file) => file.path) },
    });
    await this.completeAgentStep(task.id, "reviewer", artifacts.review);
    const testLogArtifact = await this.completeAgentStep(task.id, "tester", artifacts.testLog);
    await this.completeAgentStep(task.id, "summary", artifacts.finalReport);

    await this.addApproval({
      taskId: task.id,
      kind: "apply_patch",
      status: "pending",
      payload: {
        artifactId: patchArtifact?.id,
        artifactKind: "patch",
        artifactTitle: artifacts.patch.title,
        workspaceId: workspace.id,
      },
    });
    await this.addEvent(task.id, "approval_requested", "等待用户审批 patch");
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "system",
      action: "approval_requested",
      message: "等待用户审批 patch",
      metadata: { kind: "apply_patch" },
    });

    await this.addApproval({
      taskId: task.id,
      kind: "run_command",
      status: "pending",
      payload: {
        artifactId: testLogArtifact?.id,
        command: "pnpm test",
        workspaceId: workspace.id,
      },
    });
    await this.addEvent(task.id, "approval_requested", "等待用户审批 pnpm test");
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "system",
      action: "approval_requested",
      message: "等待用户审批 pnpm test",
      metadata: { kind: "run_command", command: "pnpm test" },
    });

    const nextTask: Task = {
      ...task,
      status: "waiting_for_approval",
      updatedAt: new Date().toISOString(),
    };
    await this.tasksRepository.updateTask(nextTask);

    return nextTask;
  }

  private async executePatchApproval(
    task: Task,
    workspace: Workspace,
    session: { controlBaseUrl: string; controlToken: string },
    approval: Approval,
  ): Promise<void> {
    const artifactId = approval.payload.artifactId;
    const patchArtifact = await this.findArtifactById(task.id, typeof artifactId === "string" ? artifactId : undefined);

    if (!patchArtifact) {
      throw new Error("Patch artifact was not found for approval.");
    }

    const result = await this.runnerExecutionClient.applyPatch({
      controlBaseUrl: session.controlBaseUrl,
      controlToken: session.controlToken,
      workspaceRoot: workspace.rootPath,
      patch: patchArtifact.content,
    });

    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "runner",
      action: "patch_applied",
      message: result.message,
      metadata: { changedFiles: result.changedFiles },
    });
    await this.updateFinalReport(
      task.id,
      [
        `任务《${task.title}》已完成 patch 执行。`,
        "当前任务状态：waiting_for_approval",
        `已修改文件：${result.changedFiles.join(", ") || "none"}`,
        "下一步：等待用户审批命令执行。",
      ].join("\n"),
    );
    await this.touchTask(task, "waiting_for_approval");
  }

  private async executeCommandApproval(
    task: Task,
    workspace: Workspace,
    session: { controlBaseUrl: string; controlToken: string },
    approval: Approval,
  ): Promise<void> {
    const command = typeof approval.payload.command === "string" ? approval.payload.command : undefined;
    if (!command) {
      throw new Error("Command approval payload is missing the command.");
    }

    const result = await this.runnerExecutionClient.runCommand({
      controlBaseUrl: session.controlBaseUrl,
      controlToken: session.controlToken,
      workspaceRoot: workspace.rootPath,
      command,
    });

    await this.updateTestLog(task.id, command, result.exitCode, result.stdout, result.stderr);
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "runner",
      action: "command_completed",
      message: `${command} exited with code ${result.exitCode}`,
      metadata: { command, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr },
    });

    if (result.exitCode === 0) {
      const completedTask: Task = {
        ...task,
        status: "completed",
        updatedAt: new Date().toISOString(),
      };
      await this.tasksRepository.updateTask(completedTask);
      await this.addEvent(task.id, "task_completed", "审批后的本地执行已完成");
      await this.addAuditEvent({
        taskId: task.id,
        workspaceId: workspace.id,
        source: "system",
        action: "task_completed",
        message: "任务已完成",
        metadata: { command, exitCode: 0 },
      });
      await this.updateFinalReport(
        task.id,
        [
          `任务《${task.title}》已完成本地执行。`,
          "当前任务状态：completed",
          `检查命令：${command}`,
          `退出码：${result.exitCode}`,
        ].join("\n"),
      );
      return;
    }

    await this.updateFinalReport(
      task.id,
      [
        `任务《${task.title}》执行失败。`,
        "当前任务状态：failed",
        `失败命令：${command}`,
        `退出码：${result.exitCode}`,
      ].join("\n"),
    );
    await this.failTask(task, workspace, `${command} exited with code ${result.exitCode}`);
  }

  private async completeAgentStep(
    taskId: string,
    agentRole: AgentRole,
    artifact?: { kind: ArtifactKind; title: string; content: string },
  ): Promise<Artifact | undefined> {
    await this.addEvent(taskId, "agent_started", `${agentRole} Agent 开始执行`, agentRole);

    let createdArtifact: Artifact | undefined;
    if (artifact) {
      createdArtifact = await this.addArtifact(taskId, artifact);
      await this.addEvent(taskId, "artifact_created", `${artifact.title} 已生成`, agentRole);
    }

    await this.addEvent(taskId, "agent_completed", `${agentRole} Agent 执行完成`, agentRole);

    return createdArtifact;
  }

  private async addArtifact(
    taskId: string,
    artifact: { kind: ArtifactKind; title: string; content: string },
  ): Promise<Artifact> {
    const createdArtifact: Artifact = {
      id: createId("artifact"),
      taskId,
      kind: artifact.kind,
      title: artifact.title,
      content: artifact.content,
      createdAt: new Date().toISOString(),
    };

    await this.tasksRepository.addArtifact(createdArtifact);

    return createdArtifact;
  }

  private async updateArtifact(taskId: string, artifact: Artifact): Promise<Artifact> {
    const updatedArtifact: Artifact = {
      ...artifact,
      taskId,
    };
    await this.tasksRepository.updateArtifact(updatedArtifact);
    return updatedArtifact;
  }

  private async addApproval(input: {
    taskId: string;
    kind: Approval["kind"];
    status: Approval["status"];
    payload: Record<string, unknown>;
    decidedAt?: string;
  }): Promise<Approval> {
    const approval: Approval = {
      id: createId("approval"),
      taskId: input.taskId,
      kind: input.kind,
      status: input.status,
      payload: input.payload,
      createdAt: new Date().toISOString(),
      decidedAt: input.decidedAt,
    };

    await this.tasksRepository.addApproval(approval);

    return approval;
  }

  private async addAuditEvent(input: Omit<AuditEvent, "id" | "createdAt">): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: createId("audit"),
      createdAt: new Date().toISOString(),
      ...input,
    };

    await this.tasksRepository.addAuditEvent(event);

    return event;
  }

  private async addEvent(
    taskId: string,
    type: AgentFlowEvent["type"],
    message: string,
    agentRole?: AgentRole,
  ): Promise<AgentFlowEvent> {
    const event: AgentFlowEvent = {
      id: createId("event"),
      taskId,
      type,
      agentRole,
      message,
      createdAt: new Date().toISOString(),
    };

    await this.tasksRepository.addEvent(event);

    return event;
  }

  private async updateTestLog(taskId: string, command: string, exitCode: number, stdout: string, stderr: string): Promise<void> {
    const testLog = await this.findArtifactByKind(taskId, "test_log");
    if (!testLog) {
      return;
    }

    await this.updateArtifact(taskId, {
      ...testLog,
      content: [
        `状态：已执行`,
        `命令：${command}`,
        `退出码：${exitCode}`,
        "stdout:",
        stdout || "(empty)",
        "stderr:",
        stderr || "(empty)",
      ].join("\n"),
    });
  }

  private async updateFinalReport(taskId: string, content: string): Promise<void> {
    const report = await this.findArtifactByKind(taskId, "final_report");
    if (!report) {
      return;
    }

    await this.updateArtifact(taskId, {
      ...report,
      content,
    });
  }

  private async findArtifactByKind(taskId: string, kind: ArtifactKind): Promise<Artifact | undefined> {
    return (await this.tasksRepository.listArtifacts(taskId)).find((artifact) => artifact.kind === kind);
  }

  private async findArtifactById(taskId: string, artifactId: string | undefined): Promise<Artifact | undefined> {
    if (!artifactId) {
      return undefined;
    }

    return (await this.tasksRepository.listArtifacts(taskId)).find((artifact) => artifact.id === artifactId);
  }

  private async getApprovalOrThrow(approvalId: string): Promise<Approval> {
    const approval = await this.tasksRepository.getApproval(approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval ${approvalId} was not found.`);
    }

    return approval;
  }

  private async getWorkspaceForTask(task: Task): Promise<Workspace> {
    const workspace = (await this.tasksRepository
      .listWorkspaces())
      .find((currentWorkspace) => currentWorkspace.id === task.workspaceId);

    if (!workspace) {
      throw new NotFoundException(`Workspace ${task.workspaceId ?? "unknown"} was not found.`);
    }

    return workspace;
  }

  private async getRunnerSessionForTask(task: Task): Promise<{ controlBaseUrl: string; controlToken: string }> {
    if (!task.workspaceId) {
      throw new NotFoundException(`Task ${task.id} is missing a workspace binding.`);
    }

    const session = await this.runnerService.getOnlineSessionForWorkspace(task.workspaceId);
    if (!session) {
      throw new NotFoundException(`No online runner session found for workspace ${task.workspaceId}.`);
    }

    return {
      controlBaseUrl: session.controlBaseUrl,
      controlToken: session.controlToken,
    };
  }

  private async touchTask(task: Task, status: Task["status"]): Promise<void> {
    await this.tasksRepository.updateTask({
      ...task,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  private async failTask(task: Task, workspace: Workspace, message: string, emitFinalReport = true): Promise<Task> {
    const failedTask: Task = {
      ...task,
      status: "failed",
      updatedAt: new Date().toISOString(),
    };
    await this.tasksRepository.updateTask(failedTask);
    await this.addEvent(task.id, "task_failed", `任务失败：${message}`);
    await this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "system",
      action: "task_failed",
      message: `任务失败：${message}`,
      metadata: { error: message },
    });

    if (emitFinalReport) {
      await this.updateFinalReport(
        task.id,
        [
          `任务《${task.title}》执行失败。`,
          "当前任务状态：failed",
          `原因：${message}`,
        ].join("\n"),
      );
    }

    return failedTask;
  }

  private async getDefaultWorkspace(): Promise<Workspace> {
    const workspace = (await this.runnerService.listWorkspaces()).find(
      (currentWorkspace) => currentWorkspace.status === "online" || currentWorkspace.status === "indexing",
    );

    if (!workspace) {
      throw new NotFoundException("No online workspace available.");
    }

    return workspace;
  }
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
