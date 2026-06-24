import { describe, expect, it } from "vitest";
import {
  AGENT_ROLES,
  ARTIFACT_KINDS,
  TASK_STAGES,
  TASK_STATUSES,
  isRunnerCommandAllowed,
  type AgentFlowEvent,
  type Approval,
  type Artifact,
  type AuditEvent,
  type CommandRun,
  type ContextSnapshot,
  type PatchApplyResult,
  type PatchLifecycle,
  type PatchPrecheck,
  type PreviewSession,
  type TaskSource,
  type Task,
  type Workspace,
  type RunnerSession,
  type RunnerCommand,
  type RunnerControlMessage,
  type RunnerHeartbeatResponse,
  type RunnerReadRequest,
  type RunnerReadResponse,
  type RunnerLifecycleEvent,
  type RunnerPatchOperationResponse,
  type RunnerPatchPrecheckRequest,
  type RunnerPreviewRequest,
  type RunnerPreviewResponse,
  type RunnerRegisterResponse,
  type RunnerResult,
  type RunnerScanRequest,
  type RunnerScanResponse,
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
    expect(TASK_STAGES).toContain("verification");
  });

  it("allows only runner commands that the V0/V2 plan recognizes", () => {
    expect(isRunnerCommandAllowed("pnpm test")).toBe(true);
    expect(isRunnerCommandAllowed("npm test")).toBe(true);
    expect(isRunnerCommandAllowed("pnpm lint")).toBe(true);
    expect(isRunnerCommandAllowed("pnpm typecheck")).toBe(true);
    expect(isRunnerCommandAllowed("rm -rf .")).toBe(false);
  });

  it("supports event and runner protocol shapes", () => {
    const task: Task = {
      id: "task_1",
      title: "Add login page",
      prompt: "Create an email login page",
      status: "running",
      stage: "artifact_generation",
      createdAt: "2026-06-23T00:00:00.000Z",
      updatedAt: "2026-06-23T00:00:00.000Z",
    };
    const event: AgentFlowEvent = {
      id: "evt_1",
      taskId: "task_1",
      type: "approval_rejected",
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
    expect(task.stage).toBe("artifact_generation");
    expect(event.type).toBe("approval_rejected");
    expect(command.command).toBe("pnpm test");
    expect(result.exitCode).toBe(0);
    expect(artifact.kind).toBe("plan");
    expect(approval.status).toBe("pending");
  });

  it("supports runner registration and heartbeat protocol shapes", () => {
    const registerMessage: Extract<RunnerControlMessage, { type: "runner_register" }> = {
      type: "runner_register",
      runnerId: "runner_1",
      workspaceRoot: "D:\\project\\demo",
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      protocolVersion: "v1",
      capabilities: ["scan_workspace", "read_files", "run_command"],
      createdAt: "2026-06-23T00:00:00.000Z",
    };
    const heartbeatMessage: Extract<RunnerControlMessage, { type: "runner_heartbeat" }> = {
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
    const registerResponse: RunnerRegisterResponse = {
      accepted: true,
      workspaceId: "workspace_1",
      sessionId: "session_1",
      status: "online",
      message: "Runner registered.",
      receivedAt: "2026-06-23T00:00:00.000Z",
    };
    const heartbeatResponse: RunnerHeartbeatResponse = {
      accepted: true,
      workspaceId: "workspace_1",
      sessionId: "session_1",
      status: "online",
      message: "Heartbeat accepted.",
      receivedAt: "2026-06-23T00:00:05.000Z",
    };

    expect(registerMessage.protocolVersion).toBe("v1");
    expect(registerMessage.capabilities).toContain("read_files");
    expect(registerMessage.controlBaseUrl).toContain("127.0.0.1");
    expect(heartbeatMessage.status).toBe("online");
    expect(lifecycleEvent.accepted).toBe(true);
    expect(registerResponse.sessionId).toBe("session_1");
    expect(heartbeatResponse.status).toBe("online");
  });

  it("supports final-product V0 skeleton domain shapes", () => {
    const workspace: Workspace = {
      id: "workspace_1",
      name: "demo-app",
      rootPath: "D:\\project\\demo-app",
      status: "online",
      runnerMode: "local",
      runnerId: "runner_1",
      lastHeartbeatAt: "2026-06-23T00:00:10.000Z",
    };
    const runnerSession: RunnerSession = {
      id: "session_1",
      runnerId: "runner_1",
      workspaceId: "workspace_1",
      workspaceRoot: "D:\\project\\demo-app",
      status: "online",
      protocolVersion: "v1",
      capabilities: ["scan_workspace", "read_files", "run_command"],
      controlBaseUrl: "http://127.0.0.1:43123",
      controlToken: "token_123",
      connectedAt: "2026-06-23T00:00:00.000Z",
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
    expect(workspace.runnerMode).toBe("local");
    expect(workspace.runnerId).toBe("runner_1");
    expect(runnerSession.protocolVersion).toBe("v1");
    expect(runnerSession.controlBaseUrl).toContain("127.0.0.1");
    expect(taskSource.kind).toBe("manual");
    expect(contextSnapshot.selectedFiles[0]?.relevance).toBe("high");
    expect(contextSnapshot.rejectedFiles[0]?.path).toBe(".env.local");
    expect(commandRun.status).toBe("passed");
    expect(previewSession.port).toBe(3001);
    expect(auditEvent.source).toBe("runner");
  });

  it("supports preview runner protocol shapes", () => {
    const previewRequest: RunnerPreviewRequest = {
      workspaceRoot: "D:\\project\\demo-app",
    };
    const previewResponse: RunnerPreviewResponse = {
      ok: true,
      message: "Preview is running.",
      preview: {
        status: "running",
        url: "http://127.0.0.1:3100",
        port: 3100,
        command: "pnpm dev --hostname 127.0.0.1 --port 3100",
        startedAt: "2026-06-24T00:00:00.000Z",
        lastHeartbeatAt: "2026-06-24T00:00:05.000Z",
      },
    };

    expect(previewRequest.workspaceRoot).toContain("demo-app");
    expect(previewResponse.ok).toBe(true);
    expect(previewResponse.preview?.status).toBe("running");
    expect(previewResponse.preview?.port).toBe(3100);
  });

  it("supports workspace scan and read protocol shapes", () => {
    const scanRequest: RunnerScanRequest = {
      workspaceRoot: "D:\\project\\demo-app",
      maxEntries: 200,
      maxDepth: 4,
    };
    const scanResponse: RunnerScanResponse = {
      workspaceRoot: "D:\\project\\demo-app",
      branch: "feat/login-flow",
      topLevelEntries: ["apps", "packages", "package.json"],
      keyFiles: [
        {
          path: "package.json",
          size: 1024,
          reason: "Workspace manifest",
        },
      ],
      stackHints: ["pnpm", "typescript", "nextjs"],
    };
    const readRequest: RunnerReadRequest = {
      workspaceRoot: "D:\\project\\demo-app",
      paths: ["package.json", "apps/web/app/page.tsx"],
    };
    const readResponse: RunnerReadResponse = {
      workspaceRoot: "D:\\project\\demo-app",
      files: [
        {
          path: "package.json",
          content: "{ \"name\": \"demo-app\" }",
        },
      ],
    };

    expect(scanRequest.maxDepth).toBe(4);
    expect(scanResponse.branch).toBe("feat/login-flow");
    expect(scanResponse.keyFiles[0]?.path).toBe("package.json");
    expect(scanResponse.stackHints).toContain("typescript");
    expect(readRequest.paths).toHaveLength(2);
    expect(readResponse.files[0]?.content).toContain("demo-app");
  });

  it("supports patch lifecycle and runner patch precheck shapes", () => {
    const precheck: PatchPrecheck = {
      status: "passed",
      changedFiles: ["apps/api/src/tasks/tasks.service.ts"],
      message: "Patch precheck passed.",
      issues: [],
      checkedAt: "2026-06-24T00:00:00.000Z",
    };
    const applyResult: PatchApplyResult = {
      status: "applied",
      changedFiles: ["apps/api/src/tasks/tasks.service.ts"],
      message: "Patch applied successfully.",
      appliedAt: "2026-06-24T00:00:05.000Z",
    };
    const lifecycle: PatchLifecycle = {
      id: "patch_lifecycle_1",
      taskId: "task_1",
      patchArtifactId: "artifact_1",
      approvalId: "approval_1",
      status: "awaiting_approval",
      precheck,
      applyResult,
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:05.000Z",
    };
    const precheckRequest: RunnerPatchPrecheckRequest = {
      workspaceRoot: "D:\\project\\demo-app",
      patch: "diff --git a/a.ts b/a.ts",
    };
    const operationResponse: RunnerPatchOperationResponse = {
      ok: false,
      message: "Patch path is outside the workspace.",
      changedFiles: [],
      failureCode: "path_not_allowed",
      issues: [
        {
          code: "path_not_allowed",
          message: "Patch path is outside the workspace.",
          path: "../outside.ts",
        },
      ],
    };

    expect(lifecycle.status).toBe("awaiting_approval");
    expect(lifecycle.precheck.status).toBe("passed");
    expect(precheckRequest.patch).toContain("diff --git");
    expect(operationResponse.failureCode).toBe("path_not_allowed");
    expect(operationResponse.issues[0]?.path).toBe("../outside.ts");
  });
});
