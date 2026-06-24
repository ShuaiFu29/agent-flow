import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPrismaClient, prisma } from "./index";

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

  it("defines the V1 durable workspace, runner, source, and audit models", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toContain("model Workspace");
    expect(schema).toContain("model RunnerSession");
    expect(schema).toContain("model TaskSource");
    expect(schema).toContain("model AuditEvent");
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
    expect(schema).toMatch(/runnerSessions\s+RunnerSession\[\]/);
    expect(schema).toMatch(/auditEvents\s+AuditEvent\[\]/);
  });
});

describe("database client exports", () => {
  it("exports a prisma singleton and a factory", () => {
    expect(prisma).toBe(createPrismaClient());
  });
});
