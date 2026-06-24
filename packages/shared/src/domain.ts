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
  workspaceId?: string;
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

export type WorkspaceStatus = "online" | "offline" | "indexing" | "error";

export type RunnerMode = "simulated" | "local" | "remote";

export type Workspace = {
  id: string;
  name: string;
  rootPath: string;
  status: WorkspaceStatus;
  runnerMode: RunnerMode;
  runnerId?: string;
  branch?: string;
  lastHeartbeatAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RunnerSessionStatus = "online" | "offline" | "busy" | "error";

export type RunnerSession = {
  id: string;
  runnerId: string;
  workspaceId: string;
  workspaceRoot: string;
  status: RunnerSessionStatus;
  protocolVersion: "v1";
  capabilities: string[];
  controlBaseUrl: string;
  controlToken: string;
  connectedAt: string;
  lastHeartbeatAt: string;
  disconnectedAt?: string;
};

export type TaskSourceKind = "manual" | "github_issue" | "document" | "clipboard";

export type TaskSource = {
  id: string;
  taskId: string;
  kind: TaskSourceKind;
  title: string;
  content: string;
  url?: string;
  createdAt: string;
};

export type ContextRelevance = "high" | "medium" | "low";

export type ContextSnapshotFile = {
  path: string;
  reason: string;
  relevance: ContextRelevance;
};

export type RejectedContextFile = {
  path: string;
  reason: string;
};

export type ContextSnapshot = {
  id: string;
  taskId: string;
  selectedFiles: ContextSnapshotFile[];
  rejectedFiles: RejectedContextFile[];
  createdAt: string;
};

export type CommandRunStatus = "queued" | "running" | "passed" | "failed" | "cancelled";

export type CommandRun = {
  id: string;
  taskId: string;
  command: string;
  status: CommandRunStatus;
  exitCode?: number;
  startedAt?: string;
  completedAt?: string;
  outputArtifactId?: string;
};

export type PreviewSessionStatus = "starting" | "running" | "stopped" | "failed";

export type PreviewSession = {
  id: string;
  taskId: string;
  workspaceId: string;
  status: PreviewSessionStatus;
  url: string;
  port: number;
  command: string;
  startedAt: string;
  stoppedAt?: string;
};

export type AuditEventSource = "user" | "system" | "agent" | "runner";

export type AuditEvent = {
  id: string;
  taskId?: string;
  workspaceId?: string;
  source: AuditEventSource;
  action: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
