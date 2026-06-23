import type { AgentRole } from "./domain";

export type AgentFlowEventType =
  | "task_created"
  | "agent_started"
  | "agent_completed"
  | "artifact_created"
  | "approval_requested"
  | "approval_granted"
  | "runner_log"
  | "task_failed"
  | "task_completed";

export type AgentFlowEvent = {
  id: string;
  taskId: string;
  type: AgentFlowEventType;
  agentRole?: AgentRole;
  message: string;
  createdAt: string;
};
