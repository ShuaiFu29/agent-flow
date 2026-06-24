import { describe, expect, it } from "vitest";
import { createCommandExecutionPlan, evaluateRunnerCommand } from "./command-policy";

describe("runner command policy", () => {
  it("allows only exact V0 runner commands", () => {
    expect(evaluateRunnerCommand("pnpm test")).toEqual({
      allowed: true,
      command: "pnpm test",
    });
    expect(evaluateRunnerCommand("npm test")).toEqual({
      allowed: true,
      command: "npm test",
    });
    expect(evaluateRunnerCommand("pnpm lint")).toEqual({
      allowed: true,
      command: "pnpm lint",
    });
    expect(evaluateRunnerCommand("npm run test")).toEqual({
      allowed: true,
      command: "npm run test",
    });
  });

  it("rejects install, destructive, chained, and unknown commands", () => {
    expect(evaluateRunnerCommand("npm install")).toMatchObject({ allowed: false });
    expect(evaluateRunnerCommand("rm -rf .")).toMatchObject({ allowed: false });
    expect(evaluateRunnerCommand("pnpm test && npm install")).toMatchObject({
      allowed: false,
    });
    expect(evaluateRunnerCommand("pnpm exec sh")).toMatchObject({ allowed: false });
    expect(evaluateRunnerCommand("")).toMatchObject({ allowed: false });
  });

  it("builds a reusable execution plan for an allowed command", () => {
    expect(createCommandExecutionPlan("pnpm test")).toMatchObject({
      allowed: true,
      command: "pnpm test",
      args: expect.any(Array),
      file: expect.any(String),
    });
  });
});
