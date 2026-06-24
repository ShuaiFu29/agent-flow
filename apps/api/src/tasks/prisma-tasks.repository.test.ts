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
