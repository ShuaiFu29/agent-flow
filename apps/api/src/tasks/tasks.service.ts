import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { from, map } from "rxjs";
import type {
  AgentFlowEvent,
  AgentRole,
  Artifact,
  ArtifactKind,
  Task,
} from "@agent-flow/shared";

type CreateTaskInput = {
  title: string;
  prompt: string;
};

@Injectable()
export class TasksService {
  private readonly tasks = new Map<string, Task>();
  private readonly events = new Map<string, AgentFlowEvent[]>();
  private readonly artifacts = new Map<string, Artifact[]>();

  createTask(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: createId("task"),
      title: input.title,
      prompt: input.prompt,
      status: "running",
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(task.id, task);
    this.events.set(task.id, []);
    this.artifacts.set(task.id, []);
    this.addEvent(task.id, "task_created", "任务已创建");

    this.runSimulatedWorkflow(task);

    const completedTask: Task = {
      ...task,
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, completedTask);
    this.addEvent(task.id, "task_completed", "模拟 Agent 工作流已完成");

    return completedTask;
  }

  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundException(`Task ${taskId} was not found.`);
    }

    return task;
  }

  listEvents(taskId: string): AgentFlowEvent[] {
    this.getTask(taskId);

    return this.events.get(taskId) ?? [];
  }

  listArtifacts(taskId: string): Artifact[] {
    this.getTask(taskId);

    return this.artifacts.get(taskId) ?? [];
  }

  streamEvents(taskId: string): Observable<MessageEvent> {
    return from(this.listEvents(taskId)).pipe(map((event) => ({ data: event })));
  }

  private runSimulatedWorkflow(task: Task): void {
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
    this.completeAgentStep(task.id, "reviewer", {
      kind: "review",
      title: "审查结果",
      content: "补丁范围清晰，未发现阻塞风险。需要用户审批后才能应用。",
    });
    this.completeAgentStep(task.id, "tester", {
      kind: "test_log",
      title: "测试日志",
      content: "V0 模拟检查通过：typecheck、lint、test。",
    });
    this.completeAgentStep(task.id, "summary", {
      kind: "final_report",
      title: "最终报告",
      content: "V0 模拟任务已完成。产物包括实现计划、补丁、审查结果和测试日志。",
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

    this.artifacts.get(taskId)?.push(createdArtifact);

    return createdArtifact;
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

    this.events.get(taskId)?.push(event);

    return event;
  }
}

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
