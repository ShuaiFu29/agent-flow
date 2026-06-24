import type {
  AgentFlowEvent,
  Approval,
  Artifact,
  AuditEvent,
  CommandRun,
  ContextSnapshot,
  PatchLifecycle,
  Task,
  TaskSource,
  Workspace,
} from "@agent-flow/shared";

type CreateTaskInput = {
  title: string;
  prompt: string;
};

export class AgentFlowApiClient {
  constructor(private readonly baseUrl: string) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.request<Task>("/tasks", {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  async listTasks(): Promise<Task[]> {
    return this.request<Task[]>("/tasks", { cache: "no-store" });
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>(`/tasks/${taskId}`, { cache: "no-store" });
  }

  async listEvents(taskId: string): Promise<AgentFlowEvent[]> {
    return this.request<AgentFlowEvent[]>(`/tasks/${taskId}/events`, { cache: "no-store" });
  }

  async listArtifacts(taskId: string): Promise<Artifact[]> {
    return this.request<Artifact[]>(`/tasks/${taskId}/artifacts`, { cache: "no-store" });
  }

  async listApprovals(taskId?: string): Promise<Approval[]> {
    const path = taskId ? `/tasks/${taskId}/approvals` : "/approvals";

    return this.request<Approval[]>(path, { cache: "no-store" });
  }

  async listAuditEvents(taskId?: string): Promise<AuditEvent[]> {
    const path = taskId ? `/tasks/${taskId}/audit` : "/audit";

    return this.request<AuditEvent[]>(path, { cache: "no-store" });
  }

  async approveApproval(approvalId: string): Promise<Approval> {
    return this.request<Approval>(`/approvals/${approvalId}/approve`, {
      method: "POST",
    });
  }

  async rejectApproval(approvalId: string): Promise<Approval> {
    return this.request<Approval>(`/approvals/${approvalId}/reject`, {
      method: "POST",
    });
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>("/workspaces", { cache: "no-store" });
  }

  async getTaskSource(taskId: string): Promise<TaskSource> {
    return this.request<TaskSource>(`/tasks/${taskId}/source`, { cache: "no-store" });
  }

  async getTaskContext(taskId: string): Promise<ContextSnapshot> {
    return this.request<ContextSnapshot>(`/tasks/${taskId}/context`, { cache: "no-store" });
  }

  async getPatchLifecycle(taskId: string): Promise<PatchLifecycle> {
    return this.request<PatchLifecycle>(`/tasks/${taskId}/patch-lifecycle`, { cache: "no-store" });
  }

  async getCommandRuns(taskId: string): Promise<CommandRun[]> {
    return this.request<CommandRun[]>(`/tasks/${taskId}/command-runs`, { cache: "no-store" });
  }

  streamUrl(taskId: string): string {
    return `${this.baseUrl}/tasks/${taskId}/stream`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}

export function createApiClient(): AgentFlowApiClient {
  return new AgentFlowApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
}
