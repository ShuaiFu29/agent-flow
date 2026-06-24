import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPrismaClient, ensureSqliteSchema } from "@agent-flow/db";
import { PrismaTasksRepository } from "./prisma-tasks.repository";

const tempRoots: string[] = [];

describe("PrismaTasksRepository", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it("persists V1 records across repository re-instantiation", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-prisma-repository-"));
    tempRoots.push(tempRoot);

    const databaseUrl = toSqliteDatabaseUrl(path.join(tempRoot, "agent-flow.db"));
    await prepareDatabase(databaseUrl);

    const prismaA = createPrismaClient({ databaseUrl, useSingleton: false });
    let prismaB:
      | ReturnType<typeof createPrismaClient>
      | undefined;

    try {
      const repositoryA = new PrismaTasksRepository(prismaA);
      const { workspace } = await repositoryA.registerRunner({
        runnerId: "runner_1",
        workspaceRoot: "D:\\project\\agent\\agent-flow",
        workspaceName: "agent-flow",
        branch: "feat/v1-workspace-runner",
        controlBaseUrl: "http://127.0.0.1:43123",
        controlToken: "token_123",
        protocolVersion: "v1",
        capabilities: ["scan_workspace", "read_files", "run_command", "apply_patch"],
        createdAt: "2026-06-24T00:00:05.000Z",
      });

      await repositoryA.createTask({
        id: "task_1",
        title: "Persist V1 state",
        prompt: "Keep records after restart.",
        workspaceId: workspace.id,
        status: "waiting_for_approval",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:00.000Z",
      });
      await repositoryA.addArtifact({
        id: "artifact_1",
        taskId: "task_1",
        kind: "plan",
        title: "Plan",
        content: "Plan content",
        createdAt: "2026-06-24T00:00:01.000Z",
      });
      await repositoryA.addApproval({
        id: "approval_1",
        taskId: "task_1",
        kind: "apply_patch",
        status: "pending",
        payload: { artifactId: "artifact_1" },
        createdAt: "2026-06-24T00:00:02.000Z",
      });
      await repositoryA.addAuditEvent({
        id: "audit_1",
        taskId: "task_1",
        workspaceId: workspace.id,
        source: "system",
        action: "approval_requested",
        message: "Approval required.",
        createdAt: "2026-06-24T00:00:03.000Z",
        metadata: { stage: "phase-d" },
      });
      await repositoryA.setTaskSource({
        id: "source_1",
        taskId: "task_1",
        kind: "manual",
        title: "Manual request",
        content: "Persist this task.",
        createdAt: "2026-06-24T00:00:04.000Z",
      });
      await repositoryA.setContextSnapshot({
        id: "snapshot_1",
        taskId: "task_1",
        selectedFiles: [
          {
            path: "apps/web/app/login/page.tsx",
            reason: "命中上游优先文件",
            relevance: "high",
          },
        ],
        rejectedFiles: [
          {
            path: "README.md",
            reason: "当前轮次未进入上下文上限。",
          },
        ],
        createdAt: "2026-06-24T00:00:04.500Z",
      });
      await repositoryA.setPatchLifecycle({
        id: "patch_1",
        taskId: "task_1",
        patchArtifactId: "artifact_1",
        approvalId: "approval_1",
        status: "awaiting_approval",
        precheck: {
          status: "passed",
          changedFiles: ["apps/api/src/tasks/tasks.service.ts"],
          message: "Patch precheck passed.",
          issues: [],
          checkedAt: "2026-06-24T00:00:04.750Z",
        },
        applyResult: {
          status: "not_started",
          changedFiles: ["apps/api/src/tasks/tasks.service.ts"],
          message: "Patch has not been applied yet.",
        },
        createdAt: "2026-06-24T00:00:04.750Z",
        updatedAt: "2026-06-24T00:00:04.750Z",
      });
      await repositoryA.setCommandRun({
        id: "command_1",
        taskId: "task_1",
        approvalId: "approval_1",
        command: "pnpm test",
        status: "passed",
        exitCode: 0,
        stdout: "task test ok\n",
        stderr: "",
        createdAt: "2026-06-24T00:00:05.000Z",
        updatedAt: "2026-06-24T00:00:12.000Z",
        startedAt: "2026-06-24T00:00:05.000Z",
        completedAt: "2026-06-24T00:00:12.000Z",
        outputArtifactId: "artifact_1",
      });
      await repositoryA.setPreviewSession({
        id: "preview_1",
        taskId: "task_1",
        workspaceId: workspace.id,
        status: "running",
        url: "http://127.0.0.1:3100",
        port: 3100,
        command: "pnpm dev -- --port 3100 --hostname 127.0.0.1",
        startedAt: "2026-06-24T00:00:12.500Z",
        lastHeartbeatAt: "2026-06-24T00:00:13.000Z",
      });

      await prismaA.$disconnect();

      prismaB = createPrismaClient({ databaseUrl, useSingleton: false });
      const repositoryB = new PrismaTasksRepository(prismaB);

      await expect(repositoryB.listTasks()).resolves.toEqual([
        expect.objectContaining({
          id: "task_1",
          status: "waiting_for_approval",
          workspaceId: workspace.id,
        }),
      ]);
      await expect(repositoryB.listArtifacts("task_1")).resolves.toEqual([
        expect.objectContaining({
          id: "artifact_1",
          content: "Plan content",
        }),
      ]);
      await expect(repositoryB.listApprovals("task_1")).resolves.toEqual([
        expect.objectContaining({
          id: "approval_1",
          status: "pending",
        }),
      ]);
      await expect(repositoryB.listAuditEvents("task_1")).resolves.toEqual([
        expect.objectContaining({
          id: "audit_1",
          action: "approval_requested",
        }),
      ]);
      await expect(repositoryB.getTaskSource("task_1")).resolves.toEqual(
        expect.objectContaining({
          id: "source_1",
          title: "Manual request",
        }),
      );
      await expect(repositoryB.getContextSnapshot("task_1")).resolves.toEqual(
        expect.objectContaining({
          id: "snapshot_1",
          selectedFiles: [
            expect.objectContaining({
              path: "apps/web/app/login/page.tsx",
              relevance: "high",
            }),
          ],
        }),
      );
      await expect(repositoryB.getPatchLifecycle("task_1")).resolves.toEqual(
        expect.objectContaining({
          id: "patch_1",
          status: "awaiting_approval",
          precheck: expect.objectContaining({
            status: "passed",
          }),
          applyResult: expect.objectContaining({
            status: "not_started",
          }),
        }),
      );
      await expect(repositoryB.listCommandRuns("task_1")).resolves.toEqual([
        expect.objectContaining({
          id: "command_1",
          approvalId: "approval_1",
          command: "pnpm test",
          status: "passed",
          exitCode: 0,
          stdout: "task test ok\n",
          stderr: "",
          outputArtifactId: "artifact_1",
        }),
      ]);
      await expect(repositoryB.getPreviewSessionByTaskId("task_1")).resolves.toEqual(
        expect.objectContaining({
          id: "preview_1",
          workspaceId: workspace.id,
          status: "running",
          port: 3100,
        }),
      );
      await expect(repositoryB.getActivePreviewSessionByWorkspaceId(workspace.id)).resolves.toEqual(
        expect.objectContaining({
          id: "preview_1",
          taskId: "task_1",
          url: "http://127.0.0.1:3100",
        }),
      );
      await expect(repositoryB.listWorkspaces()).resolves.toEqual([
        expect.objectContaining({
          id: workspace.id,
          name: "agent-flow",
        }),
      ]);
      await expect(repositoryB.listRunnerSessions()).resolves.toEqual([
        expect.objectContaining({
          runnerId: "runner_1",
          workspaceId: workspace.id,
        }),
      ]);
    } finally {
      await prismaB?.$disconnect();
      await prismaA.$disconnect();
    }
  });

  it("normalizes workspace identity for equivalent path variants", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-prisma-repository-"));
    tempRoots.push(tempRoot);

    const workspaceRoot = path.join(tempRoot, "workspace");
    const databaseUrl = toSqliteDatabaseUrl(path.join(tempRoot, "agent-flow.db"));
    await prepareDatabase(databaseUrl);

    const prisma = createPrismaClient({ databaseUrl, useSingleton: false });

    try {
      const repository = new PrismaTasksRepository(prisma);

      await repository.registerRunner({
        runnerId: "runner_1",
        workspaceRoot,
        workspaceName: "agent-flow",
        branch: "feat/v1-workspace-runner",
        controlBaseUrl: "http://127.0.0.1:43123",
        controlToken: "token_123",
        protocolVersion: "v1",
        capabilities: ["scan_workspace", "read_files"],
        createdAt: "2026-06-24T00:00:00.000Z",
      });
      await repository.registerRunner({
        runnerId: "runner_1",
        workspaceRoot: path.relative(process.cwd(), workspaceRoot),
        workspaceName: "agent-flow",
        branch: "feat/v1-workspace-runner",
        controlBaseUrl: "http://127.0.0.1:43123",
        controlToken: "token_123",
        protocolVersion: "v1",
        capabilities: ["scan_workspace", "read_files"],
        createdAt: "2026-06-24T00:00:05.000Z",
      });

      await expect(repository.listWorkspaces()).resolves.toEqual([
        expect.objectContaining({
          rootPath: path.resolve(workspaceRoot),
        }),
      ]);
      await expect(repository.listRunnerSessions()).resolves.toEqual([
        expect.objectContaining({
          workspaceRoot: path.resolve(workspaceRoot),
        }),
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });
});

async function prepareDatabase(databaseUrl: string): Promise<void> {
  ensureSqliteSchema(databaseUrl);
}

function toSqliteDatabaseUrl(databasePath: string): string {
  return `file:${databasePath.replaceAll("\\", "/")}`;
}
