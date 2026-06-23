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

  it("links events, artifacts, and approvals to tasks", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toMatch(/events\s+Event\[\]/);
    expect(schema).toMatch(/artifacts\s+Artifact\[\]/);
    expect(schema).toMatch(/approvals\s+Approval\[\]/);
    expect(schema).toContain("task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)");
  });
});

describe("database client exports", () => {
  it("exports a prisma singleton and a factory", () => {
    expect(prisma).toBe(createPrismaClient());
  });
});
