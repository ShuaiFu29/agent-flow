import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function ensureSqliteSchema(databaseUrl: string): void {
  const databasePath = resolveSqliteDatabasePath(databaseUrl);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  try {
    database.exec(SQLITE_SCHEMA);
  } finally {
    database.close();
  }
}

function resolveSqliteDatabasePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported database URL for SQLite bootstrap: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath || rawPath === ":memory:") {
    throw new Error("In-memory SQLite URLs are not supported for V1 durable persistence.");
  }

  const normalizedPath = rawPath.replace(/\//g, path.sep);
  return path.isAbsolute(normalizedPath) ? normalizedPath : path.resolve(process.cwd(), normalizedPath);
}

const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "rootPath" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "runnerMode" TEXT NOT NULL,
  "runnerId" TEXT,
  "branch" TEXT,
  "lastHeartbeatAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_rootPath_key" ON "Workspace"("rootPath");
CREATE INDEX IF NOT EXISTS "Workspace_status_idx" ON "Workspace"("status");
CREATE INDEX IF NOT EXISTS "Workspace_runnerId_idx" ON "Workspace"("runnerId");

CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "workspaceId" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_createdAt_idx" ON "Task"("createdAt");
CREATE INDEX IF NOT EXISTS "Task_workspaceId_idx" ON "Task"("workspaceId");

CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "agentRole" TEXT,
  "message" TEXT NOT NULL,
  "payload" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Event_taskId_createdAt_idx" ON "Event"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "Event_type_idx" ON "Event"("type");

CREATE TABLE IF NOT EXISTS "Artifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Artifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Artifact_taskId_kind_idx" ON "Artifact"("taskId", "kind");
CREATE INDEX IF NOT EXISTS "Artifact_createdAt_idx" ON "Artifact"("createdAt");

CREATE TABLE IF NOT EXISTS "Approval" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" DATETIME,
  CONSTRAINT "Approval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Approval_taskId_status_idx" ON "Approval"("taskId", "status");
CREATE INDEX IF NOT EXISTS "Approval_createdAt_idx" ON "Approval"("createdAt");

CREATE TABLE IF NOT EXISTS "RunnerSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runnerId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "workspaceRoot" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "protocolVersion" TEXT NOT NULL,
  "capabilities" TEXT NOT NULL,
  "controlBaseUrl" TEXT NOT NULL,
  "controlToken" TEXT NOT NULL,
  "connectedAt" DATETIME NOT NULL,
  "lastHeartbeatAt" DATETIME NOT NULL,
  "disconnectedAt" DATETIME,
  CONSTRAINT "RunnerSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RunnerSession_runnerId_key" ON "RunnerSession"("runnerId");
CREATE INDEX IF NOT EXISTS "RunnerSession_workspaceId_idx" ON "RunnerSession"("workspaceId");
CREATE INDEX IF NOT EXISTS "RunnerSession_status_idx" ON "RunnerSession"("status");

CREATE TABLE IF NOT EXISTS "TaskSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "url" TEXT,
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "TaskSource_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskSource_taskId_key" ON "TaskSource"("taskId");

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT,
  "workspaceId" TEXT,
  "source" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "AuditEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditEvent_taskId_createdAt_idx" ON "AuditEvent"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_action_idx" ON "AuditEvent"("action");
`;
