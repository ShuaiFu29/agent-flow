import { describe, expect, it } from "vitest";
import { getTaskStatusLabel, getTaskStatusTone, isWaitingForApproval } from "./task-status";

describe("task status helpers", () => {
  it("treats waiting_for_approval as the approval gate state", () => {
    expect(isWaitingForApproval("waiting_for_approval")).toBe(true);
    expect(getTaskStatusLabel("waiting_for_approval")).toBe("等待审批");
    expect(getTaskStatusTone("waiting_for_approval")).toBe("amber");
  });

  it("keeps completed as a backward-compatible approval state", () => {
    expect(isWaitingForApproval("completed")).toBe(true);
    expect(getTaskStatusLabel("completed")).toBe("等待审批");
    expect(getTaskStatusTone("completed")).toBe("amber");
  });

  it("maps running and failed to their own labels", () => {
    expect(getTaskStatusLabel("running")).toBe("运行中");
    expect(getTaskStatusTone("running")).toBe("blue");
    expect(getTaskStatusLabel("failed")).toBe("失败");
    expect(getTaskStatusTone("failed")).toBe("red");
  });
});
