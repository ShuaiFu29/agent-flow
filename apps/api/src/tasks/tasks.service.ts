import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { from, map } from "rxjs";
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
import { TASKS_REPOSITORY, type TasksRepository } from "./tasks.repository";

type CreateTaskInput = {
  title: string;
  prompt: string;
};

@Injectable()
export class TasksService {
  constructor(
    @Inject(TASKS_REPOSITORY)
    private readonly tasksRepository: TasksRepository,
  ) {}

  createTask(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const workspace = this.getDefaultWorkspace();
    const task: Task = {
      id: createId("task"),
      title: input.title,
      prompt: input.prompt,
      workspaceId: workspace.id,
      status: "running",
      createdAt: now,
      updatedAt: now,
    };

    this.tasksRepository.createTask(task);
    this.tasksRepository.setTaskSource({
      id: createId("source"),
      taskId: task.id,
      kind: "manual",
      title: input.title,
      content: input.prompt,
      createdAt: now,
    });

    this.addEvent(task.id, "task_created", "任务已创建");
    this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "user",
      action: "task_created",
      message: `用户创建任务：${input.title}`,
      metadata: { workspaceId: workspace.id },
    });

    this.runSimulatedWorkflow(task, workspace);

    const completedTask: Task = {
      ...task,
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
    this.tasksRepository.updateTask(completedTask);
    this.addEvent(task.id, "task_completed", "模拟 Agent 工作流已完成");
    this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "system",
      action: "task_completed",
      message: "V0 模拟任务已完成",
      metadata: { status: "completed" },
    });

    return completedTask;
  }

  listTasks(): Task[] {
    return this.tasksRepository.listTasks();
  }

  getTask(taskId: string): Task {
    const task = this.tasksRepository.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} was not found.`);
    }

    return task;
  }

  listEvents(taskId: string): AgentFlowEvent[] {
    this.getTask(taskId);

    return this.tasksRepository.listEvents(taskId);
  }

  listArtifacts(taskId: string): Artifact[] {
    this.getTask(taskId);

    return this.tasksRepository.listArtifacts(taskId);
  }

  listApprovals(taskId?: string): Approval[] {
    if (taskId) {
      this.getTask(taskId);
    }

    return this.tasksRepository.listApprovals(taskId);
  }

  listAuditEvents(taskId?: string): AuditEvent[] {
    if (taskId) {
      this.getTask(taskId);
    }

    return this.tasksRepository.listAuditEvents(taskId);
  }

  getTaskSource(taskId: string): TaskSource {
    this.getTask(taskId);
    const source = this.tasksRepository.getTaskSource(taskId);

    if (!source) {
      throw new NotFoundException(`Task source for ${taskId} was not found.`);
    }

    return source;
  }

  listWorkspaces(): Workspace[] {
    return this.tasksRepository.listWorkspaces();
  }

  streamEvents(taskId: string): Observable<MessageEvent> {
    return from(this.listEvents(taskId)).pipe(map((event) => ({ data: event })));
  }

  private runSimulatedWorkflow(task: Task, workspace: Workspace): void {
    this.completeAgentStep(task.id, "planner", {
      kind: "plan",
      title: "实现计划",
      content: [
        `任务：${task.title}`,
        "1. 阅读需求并确认受影响页面。",
        "2. 生成最小可审查补丁。",
        "3. 补充测试并等待用户审批。",
      ].join("\n"),
    });

    this.addArtifact(task.id, {
      kind: "workspace_summary",
      title: "工作区摘要",
      content: [
        `工作区：${workspace.name}`,
        `路径：${workspace.rootPath}`,
        `分支：${workspace.branch ?? "main"}`,
        "安全策略：补丁审批后才允许写入。",
      ].join("\n"),
    });
    this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "agent",
      action: "context_snapshot_created",
      message: `已绑定工作区 ${workspace.name} 并生成摘要`,
      metadata: { workspaceId: workspace.id },
    });

    this.completeAgentStep(task.id, "coder", {
      kind: "patch",
      title: "patch.diff",
      content: [
        "diff --git a/src/app/login/page.tsx b/src/app/login/page.tsx",
        "+ export default function LoginPage() {",
        "+   return <LoginForm />;",
        "+ }",
      ].join("\n"),
    });
    this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "agent",
      action: "patch_created",
      message: "编码 Agent 已生成 patch 产物",
    });

    this.completeAgentStep(task.id, "reviewer", {
      kind: "review",
      title: "审查结果",
      content: "补丁范围清晰，未发现阻塞风险。需要用户审批后才能应用。",
    });

    this.addApproval({
      taskId: task.id,
      kind: "apply_patch",
      status: "pending",
      payload: {
        artifactKind: "patch",
        artifactTitle: "patch.diff",
        workspaceId: workspace.id,
      },
    });
    this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "system",
      action: "approval_requested",
      message: "等待用户审批 patch",
      metadata: { kind: "apply_patch" },
    });

    this.completeAgentStep(task.id, "tester", {
      kind: "test_log",
      title: "测试日志",
      content: "V0 模拟检查通过：typecheck、lint、test。",
    });
    this.addApproval({
      taskId: task.id,
      kind: "run_command",
      status: "approved",
      payload: {
        command: "pnpm test",
        workspaceId: workspace.id,
      },
      decidedAt: new Date().toISOString(),
    });
    this.addAuditEvent({
      taskId: task.id,
      workspaceId: workspace.id,
      source: "runner",
      action: "command_completed",
      message: "pnpm test passed",
      metadata: { command: "pnpm test", exitCode: 0 },
    });

    this.completeAgentStep(task.id, "summary", {
      kind: "final_report",
      title: "最终报告",
      content: "V0 模拟任务已完成。产物包括实现计划、工作区摘要、补丁、审查结果和测试日志。",
    });
  }

  private completeAgentStep(
    taskId: string,
    agentRole: AgentRole,
    artifact?: { kind: ArtifactKind; title: string; content: string },
  ): void {
    this.addEvent(taskId, "agent_started", `${agentRole} Agent 开始执行`, agentRole);

    if (artifact) {
      this.addArtifact(taskId, artifact);
      this.addEvent(taskId, "artifact_created", `${artifact.title} 已生成`, agentRole);
    }

    this.addEvent(taskId, "agent_completed", `${agentRole} Agent 执行完成`, agentRole);
  }

  private addArtifact(
    taskId: string,
    artifact: { kind: ArtifactKind; title: string; content: string },
  ): Artifact {
    const createdArtifact: Artifact = {
      id: createId("artifact"),
      taskId,
      kind: artifact.kind,
      title: artifact.title,
      content: artifact.content,
      createdAt: new Date().toISOString(),
    };

    this.tasksRepository.addArtifact(createdArtifact);

    return createdArtifact;
  }

  private addApproval(input: {
    taskId: string;
    kind: Approval["kind"];
    status: Approval["status"];
    payload: Record<string, unknown>;
    decidedAt?: string;
  }): Approval {
    const approval: Approval = {
      id: createId("approval"),
      taskId: input.taskId,
      kind: input.kind,
      status: input.status,
      payload: input.payload,
      createdAt: new Date().toISOString(),
      decidedAt: input.decidedAt,
    };

    this.tasksRepository.addApproval(approval);

    return approval;
  }

  private addAuditEvent(input: Omit<AuditEvent, "id" | "createdAt">): AuditEvent {
    const event: AuditEvent = {
      id: createId("audit"),
      createdAt: new Date().toISOString(),
      ...input,
    };

    this.tasksRepository.addAuditEvent(event);

    return event;
  }

  private addEvent(
    taskId: string,
    type: AgentFlowEvent["type"],
    message: string,
    agentRole?: AgentRole,
  ): AgentFlowEvent {
    const event: AgentFlowEvent = {
      id: createId("event"),
      taskId,
      type,
      agentRole,
      message,
      createdAt: new Date().toISOString(),
    };

    this.tasksRepository.addEvent(event);

    return event;
  }

  private getDefaultWorkspace(): Workspace {
    const workspace = this.tasksRepository.listWorkspaces()[0];

    if (!workspace) {
      throw new NotFoundException("No workspace available.");
    }

    return workspace;
  }
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
