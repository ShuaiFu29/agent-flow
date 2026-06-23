import { describe, expect, it } from "vitest";
import {
  REQUIRED_ARTIFACT_KINDS,
  createV0TaskFlow,
  validateV0TaskFlow,
} from "./v0-smoke.mjs";

describe("v0 smoke validation", () => {
  it("accepts a completed V0 task with required events and artifacts", () => {
    const task = createTask({ id: "task_1", status: "completed" });
    const events = [
      createEvent({ taskId: task.id, type: "task_created" }),
      createEvent({ taskId: task.id, type: "agent_started" }),
      createEvent({ taskId: task.id, type: "artifact_created" }),
      createEvent({ taskId: task.id, type: "task_completed" }),
    ];
    const artifacts = REQUIRED_ARTIFACT_KINDS.map((kind) =>
      createArtifact({ taskId: task.id, kind }),
    );

    expect(() => validateV0TaskFlow({ task, events, artifacts })).not.toThrow();
  });

  it("rejects a task flow that is missing a required artifact kind", () => {
    const task = createTask({ id: "task_1", status: "completed" });
    const events = [
      createEvent({ taskId: task.id, type: "task_created" }),
      createEvent({ taskId: task.id, type: "task_completed" }),
    ];
    const artifacts = REQUIRED_ARTIFACT_KINDS.filter((kind) => kind !== "review").map((kind) =>
      createArtifact({ taskId: task.id, kind }),
    );

    expect(() => validateV0TaskFlow({ task, events, artifacts })).toThrow(
      "Missing required artifacts: review",
    );
  });

  it("creates a task and fetches events and artifacts from the API", async () => {
    const calls = [];
    const task = createTask({ id: "task_1", status: "completed" });
    const events = [
      createEvent({ taskId: task.id, type: "task_created" }),
      createEvent({ taskId: task.id, type: "task_completed" }),
    ];
    const artifacts = REQUIRED_ARTIFACT_KINDS.map((kind) =>
      createArtifact({ taskId: task.id, kind }),
    );
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });

      if (url === "http://api.test/tasks" && init?.method === "POST") {
        return createResponse(task);
      }

      if (url === "http://api.test/tasks/task_1/events") {
        return createResponse(events);
      }

      if (url === "http://api.test/tasks/task_1/artifacts") {
        return createResponse(artifacts);
      }

      throw new Error(`Unexpected request: ${url}`);
    };

    const result = await createV0TaskFlow({
      apiBaseUrl: "http://api.test",
      fetchImpl,
      title: "Smoke task",
      prompt: "Verify V0 demo path.",
    });

    expect(result.task.id).toBe(task.id);
    expect(result.events).toHaveLength(2);
    expect(result.artifacts).toHaveLength(REQUIRED_ARTIFACT_KINDS.length);
    expect(calls.map((call) => call.url)).toEqual([
      "http://api.test/tasks",
      "http://api.test/tasks/task_1/events",
      "http://api.test/tasks/task_1/artifacts",
    ]);
  });
});

function createTask(overrides = {}) {
  return {
    id: "task_1",
    title: "Smoke task",
    prompt: "Verify V0 demo path.",
    status: "completed",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

function createEvent(overrides = {}) {
  return {
    id: `event_${overrides.type ?? "task_created"}`,
    taskId: "task_1",
    type: "task_created",
    message: "event",
    createdAt: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

function createArtifact(overrides = {}) {
  return {
    id: `artifact_${overrides.kind ?? "plan"}`,
    taskId: "task_1",
    kind: "plan",
    title: "artifact",
    content: "content",
    createdAt: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

function createResponse(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
