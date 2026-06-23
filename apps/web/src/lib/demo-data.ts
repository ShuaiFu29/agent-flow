import type { AgentFlowEvent, Artifact, Task } from "@agent-flow/shared";

export const demoTask: Task = {
  id: "demo_task",
  title: "增加邮箱登录流程",
  prompt: "在现有项目中增加登录页面，支持邮箱和密码登录。",
  status: "completed",
  createdAt: "2026-06-23T00:00:00.000Z",
  updatedAt: "2026-06-23T00:00:00.000Z",
};

export const demoEvents: AgentFlowEvent[] = [
  event("task_created", "任务已创建"),
  event("agent_started", "planner Agent 开始执行", "planner"),
  event("artifact_created", "实现计划已生成", "planner"),
  event("agent_completed", "planner Agent 执行完成", "planner"),
  event("agent_started", "coder Agent 开始执行", "coder"),
  event("artifact_created", "patch.diff 已生成", "coder"),
  event("agent_completed", "coder Agent 执行完成", "coder"),
  event("agent_started", "reviewer Agent 开始执行", "reviewer"),
  event("artifact_created", "审查结果已生成", "reviewer"),
  event("agent_completed", "reviewer Agent 执行完成", "reviewer"),
  event("agent_started", "tester Agent 开始执行", "tester"),
  event("artifact_created", "测试日志已生成", "tester"),
  event("agent_completed", "tester Agent 执行完成", "tester"),
  event("task_completed", "模拟 Agent 工作流已完成"),
];

demoEvents.splice(
  demoEvents.length - 1,
  0,
  event("agent_started", "summary Agent 开始执行", "summary"),
  event("artifact_created", "最终报告已生成", "summary"),
  event("agent_completed", "summary Agent 执行完成", "summary"),
);

export const demoArtifacts: Artifact[] = [
  artifact("plan", "实现计划", "1. 阅读需求并确认受影响页面。\n2. 生成最小可审查补丁。\n3. 补充测试并等待用户审批。"),
  artifact("patch", "patch.diff", "diff --git a/src/app/login/page.tsx b/src/app/login/page.tsx\n+ export default function LoginPage() {\n+   return <LoginForm />;\n+ }"),
  artifact("review", "审查结果", "补丁范围清晰，未发现阻塞风险。需要用户审批后才能应用。"),
  artifact("test_log", "测试日志", "V0 模拟检查通过：typecheck、lint、test。"),
  artifact("final_report", "最终报告", "V0 模拟任务已完成。产物包括实现计划、补丁、审查结果和测试日志。"),
];

function event(type: AgentFlowEvent["type"], message: string, agentRole?: AgentFlowEvent["agentRole"]): AgentFlowEvent {
  return {
    id: `demo_event_${type}_${message}`,
    taskId: demoTask.id,
    type,
    agentRole,
    message,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}

function artifact(kind: Artifact["kind"], title: string, content: string): Artifact {
  return {
    id: `demo_artifact_${kind}`,
    taskId: demoTask.id,
    kind,
    title,
    content,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}
