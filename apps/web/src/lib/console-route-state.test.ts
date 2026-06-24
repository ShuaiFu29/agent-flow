import { describe, expect, test } from "vitest";
import { getConsoleRouteState } from "./console-route-state";

describe("console route state", () => {
  test.each([
    ["/tasks", "tasks", "overview", null],
    ["/tasks/new", "tasks", "create", null],
    ["/tasks/task_123", "tasks", "detail", "task_123"],
    ["/workspaces", "workspace", "overview", null],
    ["/artifacts", "artifacts", "overview", null],
    ["/approvals", "approvals", "overview", null],
    ["/audit", "audit", "overview", null],
    ["/settings", "settings", "overview", null],
  ] as const)("maps %s to a stable console view", (pathname, view, mode, taskId) => {
    expect(getConsoleRouteState(pathname)).toEqual({
      taskId,
      taskMode: mode,
      view,
    });
  });
});
