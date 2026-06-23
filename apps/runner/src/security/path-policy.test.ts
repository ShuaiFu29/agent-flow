import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateWorkspacePath } from "./path-policy";

describe("runner path policy", () => {
  const workspaceRoot = path.resolve("D:/project/demo");

  it("allows relative paths inside the workspace", () => {
    expect(evaluateWorkspacePath(workspaceRoot, "src/index.ts")).toMatchObject({
      allowed: true,
      relativePath: "src/index.ts",
    });
  });

  it("rejects traversal and absolute paths outside the workspace", () => {
    expect(evaluateWorkspacePath(workspaceRoot, "../outside.txt")).toMatchObject({
      allowed: false,
    });
    expect(evaluateWorkspacePath(workspaceRoot, "C:/Windows/System32/drivers/etc/hosts")).toMatchObject({
      allowed: false,
    });
  });

  it("rejects ignored directories and sensitive files", () => {
    expect(evaluateWorkspacePath(workspaceRoot, "node_modules/pkg/index.js")).toMatchObject({
      allowed: false,
    });
    expect(evaluateWorkspacePath(workspaceRoot, ".git/config")).toMatchObject({
      allowed: false,
    });
    expect(evaluateWorkspacePath(workspaceRoot, ".env")).toMatchObject({
      allowed: false,
    });
    expect(evaluateWorkspacePath(workspaceRoot, "certs/private.pem")).toMatchObject({
      allowed: false,
    });
  });
});
