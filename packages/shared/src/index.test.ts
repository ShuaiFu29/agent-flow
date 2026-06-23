import { describe, expect, it } from "vitest";
import {
  AGENT_ROLES,
  ARTIFACT_KINDS,
  TASK_STATUSES,
  isRunnerCommandAllowed,
  type AgentFlowEvent,
  type Approval,
  type Artifact,
  type AuditEvent,
  type CommandRun,
  type ContextSnapshot,
  type PreviewSession,
  type TaskSource,
  type Task,
  type Workspace,
  type RunnerCommand,
  type RunnerControlMessage,
  type RunnerLifecycleEvent,
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
    const task: Task = {
      id: "task_1",
      title: "Add login page",
      prompt: "Create an email login page",
      status: "running",
      createdAt: "2026-06-23T00:00:00.000Z",
      updatedAt: "2026-06-23T00:00:00.000Z",
    };
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
    const artifact: Artifact = {
      id: "artifact_1",
      taskId: "task_1",
      kind: "plan",
      title: "Implementation plan",
      content: "Build the form first.",
      createdAt: "2026-06-23T00:00:00.000Z",
    };
    const approval: Approval = {
      id: "approval_1",
      taskId: "task_1",
      kind: "apply_patch",
      status: "pending",
      payload: { patchArtifactId: "artifact_1" },
      createdAt: "2026-06-23T00:00:00.000Z",
    };

    expect(task.status).toBe("running");
    expect(event.agentRole).toBe("planner");
    expect(command.command).toBe("pnpm test");
    expect(result.exitCode).toBe(0);
    expect(artifact.kind).toBe("plan");
    expect(approval.status).toBe("pending");
  });

  it("supports runner registration and heartbeat protocol shapes", () => {
    const registerMessage: RunnerControlMessage = {
      type: "runner_register",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\demo",
      protocolVersion: "v0",
      capabilities: ["scan_workspace", "read_files", "run_command"],
      createdAt: "2026-06-23T00:00:00.000Z",
    };
    const heartbeatMessage: RunnerControlMessage = {
      type: "runner_heartbeat",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\demo",
      status: "online",
      sentAt: "2026-06-23T00:00:05.000Z",
    };
    const lifecycleEvent: RunnerLifecycleEvent = {
      type: "runner_registered",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\demo",
      accepted: true,
      message: "Runner accepted.",
      createdAt: "2026-06-23T00:00:00.000Z",
    };

    expect(registerMessage.protocolVersion).toBe("v0");
    expect(registerMessage.capabilities).toContain("read_files");
    expect(heartbeatMessage.status).toBe("online");
    expect(lifecycleEvent.accepted).toBe(true);
  });

  it("supports final-product V0 skeleton domain shapes", () => {
    const workspace: Workspace = {
      id: "workspace_1",
      name: "demo-app",
      rootPath: "D:\\project\\demo-app",
      status: "online",
      runnerMode: "simulated",
      lastHeartbeatAt: "2026-06-23T00:00:10.000Z",
    };
    const taskSource: TaskSource = {
      id: "source_1",
      taskId: "task_1",
      kind: "manual",
      title: "Add login flow",
      content: "Add an email login flow.",
      createdAt: "2026-06-23T00:00:00.000Z",
    };
    const contextSnapshot: ContextSnapshot = {
      id: "snapshot_1",
      taskId: "task_1",
      selectedFiles: [
        { path: "src/app/login/page.tsx", reason: "Login route", relevance: "high" },
      ],
      rejectedFiles: [
        { path: ".env.local", reason: "Sensitive file" },
      ],
      createdAt: "2026-06-23T00:00:00.000Z",
    };
    const commandRun: CommandRun = {
      id: "command_1",
      taskId: "task_1",
      command: "pnpm test",
      status: "passed",
      exitCode: 0,
      startedAt: "2026-06-23T00:00:00.000Z",
      completedAt: "2026-06-23T00:00:05.000Z",
    };
    const previewSession: PreviewSession = {
      id: "preview_1",
      taskId: "task_1",
      workspaceId: "workspace_1",
      status: "running",
      url: "http://127.0.0.1:3001",
      port: 3001,
      command: "pnpm dev",
      startedAt: "2026-06-23T00:00:00.000Z",
    };
    const auditEvent: AuditEvent = {
      id: "audit_1",
      taskId: "task_1",
      source: "runner",
      action: "command_completed",
      message: "pnpm test passed",
      createdAt: "2026-06-23T00:00:05.000Z",
    };

    expect(workspace.status).toBe("online");
    expect(workspace.runnerMode).toBe("simulated");
    expect(taskSource.kind).toBe("manual");
    expect(contextSnapshot.selectedFiles[0]?.relevance).toBe("high");
    expect(contextSnapshot.rejectedFiles[0]?.path).toBe(".env.local");
    expect(commandRun.status).toBe("passed");
    expect(previewSession.port).toBe(3001);
    expect(auditEvent.source).toBe("runner");
  });
});
