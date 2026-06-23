export const TASK_STATUSES = [
  "queued",
  "running",
  "waiting_for_approval",
  "failed",
  "completed",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const AGENT_ROLES = [
  "planner",
  "context",
  "coder",
  "reviewer",
  "tester",
  "summary",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const ARTIFACT_KINDS = [
  "plan",
  "workspace_summary",
  "patch",
  "review",
  "test_log",
  "final_report",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
