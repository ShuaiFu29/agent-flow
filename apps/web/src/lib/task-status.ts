import type { TaskStatus } from "@agent-flow/shared";

export function isWaitingForApproval(status: TaskStatus): boolean {
  return status === "waiting_for_approval" || status === "completed";
}

export function getTaskStatusLabel(status: TaskStatus): string {
  if (isWaitingForApproval(status)) {
    return "等待审批";
  }

  if (status === "failed") {
    return "失败";
  }

  return "运行中";
}

export function getTaskStatusTone(status: TaskStatus): "amber" | "blue" | "red" {
  if (isWaitingForApproval(status)) {
    return "amber";
  }

  if (status === "failed") {
    return "red";
  }

  return "blue";
}
