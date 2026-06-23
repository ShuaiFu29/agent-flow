import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentFlowApiClient } from "./api";

describe("AgentFlowApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a task through the V0 API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "task_1",
        title: "增加邮箱登录流程",
        prompt: "增加登录页面",
        status: "completed",
        createdAt: "2026-06-23T00:00:00.000Z",
        updatedAt: "2026-06-23T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new AgentFlowApiClient("http://localhost:4000");
    const task = await client.createTask({
      title: "增加邮箱登录流程",
      prompt: "增加登录页面",
    });

    expect(task.id).toBe("task_1");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/tasks", {
      body: JSON.stringify({
        title: "增加邮箱登录流程",
        prompt: "增加登录页面",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("loads tasks, events, and artifacts by task id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: "task_1", title: "任务", prompt: "提示", status: "completed" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "event_1", taskId: "task_1", type: "task_created" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "artifact_1", taskId: "task_1", kind: "plan" }]));
    vi.stubGlobal("fetch", fetchMock);

    const client = new AgentFlowApiClient("http://localhost:4000");

    await expect(client.listTasks()).resolves.toHaveLength(1);
    await expect(client.listEvents("task_1")).resolves.toHaveLength(1);
    await expect(client.listArtifacts("task_1")).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/tasks", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:4000/tasks/task_1/events", { cache: "no-store" });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "http://localhost:4000/tasks/task_1/artifacts", { cache: "no-store" });
  });

  it("throws a useful error when the API returns a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" }));

    const client = new AgentFlowApiClient("http://localhost:4000");

    await expect(client.listTasks()).rejects.toThrow("API request failed: 500 Server Error");
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  } as Response;
}
