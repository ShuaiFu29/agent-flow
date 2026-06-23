import { describe, expect, it } from "vitest";
import {
  AGENT_ROLES,
  ARTIFACT_KINDS,
  TASK_STATUSES,
  isRunnerCommandAllowed,
  type AgentFlowEvent,
  type RunnerCommand,
  type RunnerResult,
} from "./index";

describe("shared domain exports", () => {
  it("exports stable task, agent, and artifact constants", () => {
    expect(TASK_STATUSES).toEqual([
      "queued",
      "running",
      "waiting_for_approval",
      "failed",
      "completed",
    ]);
    expect(AGENT_ROLES).toEqual([
      "planner",
      "context",
      "coder",
      "reviewer",
      "tester",
      "summary",
    ]);
    expect(ARTIFACT_KINDS).toContain("patch");
  });

  it("allows only runner commands that the V0/V2 plan recognizes", () => {
    expect(isRunnerCommandAllowed("pnpm test")).toBe(true);
    expect(isRunnerCommandAllowed("npm test")).toBe(true);
    expect(isRunnerCommandAllowed("pnpm lint")).toBe(true);
    expect(isRunnerCommandAllowed("rm -rf .")).toBe(false);
  });

  it("supports event and runner protocol shapes", () => {
    const event: AgentFlowEvent = {
      id: "evt_1",
      taskId: "task_1",
      type: "agent_started",
      agentRole: "planner",
      message: "Planner started",
      createdAt: "2026-06-23T00:00:00.000Z",
    };
    const command: RunnerCommand = {
      type: "run_command",
      commandId: "cmd_1",
      taskId: "task_1",
      command: "pnpm test",
    };
    const result: RunnerResult = {
      type: "command_completed",
      commandId: "cmd_1",
      exitCode: 0,
    };

    expect(event.agentRole).toBe("planner");
    expect(command.command).toBe("pnpm test");
    expect(result.exitCode).toBe(0);
  });
});
