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

export type Task = {
  id: string;
  title: string;
  prompt: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type Artifact = {
  id: string;
  taskId: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  createdAt: string;
};

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Approval = {
  id: string;
  taskId: string;
  kind: "apply_patch" | "run_command";
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  createdAt: string;
  decidedAt?: string;
};
