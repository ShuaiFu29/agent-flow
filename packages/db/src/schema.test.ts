import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createPrismaClient, ensureSqliteSchema, prisma } from "./index";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaPath = join(packageRoot, "prisma", "schema.prisma");

describe("Prisma schema", () => {
  it("defines the V0 persistence models", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toContain("model Task");
    expect(schema).toContain("model Event");
    expect(schema).toContain("model Artifact");
    expect(schema).toContain("model Approval");
  });

  it("defines the V1 durable workspace, runner, source, audit, context snapshot, and patch lifecycle models", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toContain("model Workspace");
    expect(schema).toContain("model RunnerSession");
    expect(schema).toContain("model TaskSource");
    expect(schema).toContain("model AuditEvent");
    expect(schema).toContain("model ContextSnapshot");
    expect(schema).toContain("model PatchLifecycle");
    expect(schema).toContain("model CommandRun");
    expect(schema).toContain("model PreviewSession");
  });

  it("links events, artifacts, and approvals to tasks", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toMatch(/events\s+Event\[\]/);
    expect(schema).toMatch(/artifacts\s+Artifact\[\]/);
    expect(schema).toMatch(/approvals\s+Approval\[\]/);
    expect(schema).toContain("task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)");
  });

  it("links tasks to task sources and workspaces, and runner sessions to workspaces", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toMatch(/workspaceId\s+String\?/);
    expect(schema).toMatch(/workspace\s+Workspace\?/);
    expect(schema).toMatch(/taskSource\s+TaskSource\?/);
    expect(schema).toMatch(/contextSnapshot\s+ContextSnapshot\?/);
    expect(schema).toMatch(/patchLifecycle\s+PatchLifecycle\?/);
    expect(schema).toMatch(/commandRuns\s+CommandRun\[\]/);
    expect(schema).toMatch(/previewSessions\s+PreviewSession\[\]/);
    expect(schema).toMatch(/runnerSessions\s+RunnerSession\[\]/);
    expect(schema).toMatch(/auditEvents\s+AuditEvent\[\]/);
  });
});

describe("database client exports", () => {
  it("exports a prisma singleton and a factory", () => {
    expect(prisma).toBe(createPrismaClient());
  });
});

describe("SQLite bootstrap upgrades", () => {
  it("adds newly required CommandRun columns to an existing database", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-flow-db-upgrade-"));
    const databasePath = join(root, "agent-flow.db");
    const database = new DatabaseSync(databasePath);

    try {
      database.exec(`
        CREATE TABLE "CommandRun" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "taskId" TEXT NOT NULL,
          "command" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "exitCode" INTEGER,
          "startedAt" DATETIME,
          "completedAt" DATETIME,
          "outputArtifactId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `);
    } finally {
      database.close();
    }

    ensureSqliteSchema(`file:${databasePath.replaceAll("\\", "/")}`);

    const upgradedDatabase = new DatabaseSync(databasePath);
    try {
      const columns = upgradedDatabase
        .prepare(`PRAGMA table_info("CommandRun")`)
        .all() as Array<{ name: string }>;
      const columnNames = columns.map((column) => column.name);

      expect(columnNames).toContain("approvalId");
      expect(columnNames).toContain("stdout");
      expect(columnNames).toContain("stderr");
    } finally {
      upgradedDatabase.close();
    }
  });

  it("adds newly required PreviewSession columns to an existing database", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-flow-preview-upgrade-"));
    const databasePath = join(root, "agent-flow.db");
    const database = new DatabaseSync(databasePath);

    try {
      database.exec(`
        CREATE TABLE "PreviewSession" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "taskId" TEXT NOT NULL,
          "workspaceId" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "port" INTEGER NOT NULL,
          "command" TEXT NOT NULL,
          "startedAt" DATETIME NOT NULL
        );
      `);
    } finally {
      database.close();
    }

    ensureSqliteSchema(`file:${databasePath.replaceAll("\\", "/")}`);

    const upgradedDatabase = new DatabaseSync(databasePath);
    try {
      const columns = upgradedDatabase
        .prepare(`PRAGMA table_info("PreviewSession")`)
        .all() as Array<{ name: string }>;
      const columnNames = columns.map((column) => column.name);

      expect(columnNames).toContain("stoppedAt");
      expect(columnNames).toContain("lastHeartbeatAt");
      expect(columnNames).toContain("failureMessage");
    } finally {
      upgradedDatabase.close();
    }
  });
});
