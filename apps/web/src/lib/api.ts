import type { AgentFlowEvent, Artifact, Task } from "@agent-flow/shared";

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
