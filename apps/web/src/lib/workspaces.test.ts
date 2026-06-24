import { describe, expect, it } from "vitest";
import type { Workspace } from "@agent-flow/shared";
import { resolveWorkspacePresentation } from "./workspaces";

const demoWorkspace: Workspace = {
  id: "workspace_demo",
  name: "demo-app",
  rootPath: "D:\\project\\demo-app",
  status: "online",
  runnerMode: "simulated",
};

describe("resolveWorkspacePresentation", () => {
  it("keeps a real empty state when the API is online but no workspace is registered", () => {
    const result = resolveWorkspacePresentation({
      apiOnline: true,
      workspaces: [],
      demoWorkspaces: [demoWorkspace],
    });

    expect(result.workspaces).toEqual([]);
    expect(result.showDemoFallback).toBe(false);
    expect(result.showEmptyState).toBe(true);
  });

  it("falls back to demo workspaces only when the API is offline", () => {
    const result = resolveWorkspacePresentation({
      apiOnline: false,
      workspaces: [],
      demoWorkspaces: [demoWorkspace],
    });

    expect(result.workspaces).toEqual([demoWorkspace]);
    expect(result.showDemoFallback).toBe(true);
    expect(result.showEmptyState).toBe(false);
  });
});
