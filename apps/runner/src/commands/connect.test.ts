import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createHeartbeatMessage,
  createRegisterMessage,
  parseConnectOptions,
} from "./connect";

describe("runner connect command", () => {
  it("parses workspace and API options with conservative defaults", () => {
    const options = parseConnectOptions([
      "--workspace",
      ".",
      "--api",
      "http://localhost:4000",
      "--runner-id",
      "runner_test",
    ]);

    expect(options).toEqual({
      workspace: ".",
      apiUrl: "http://localhost:4000",
      runnerId: "runner_test",
    });
  });

  it("creates a v0 register message for the resolved workspace", () => {
    const workspaceRoot = path.resolve("D:/project/demo");
    const message = createRegisterMessage({
      workspaceRoot,
      runnerId: "runner_test",
      now: "2026-06-23T00:00:00.000Z",
    });

    expect(message).toEqual({
      type: "runner_register",
      runnerId: "runner_test",
      workspaceRoot,
      protocolVersion: "v0",
      capabilities: ["scan_workspace", "read_files", "run_command"],
      createdAt: "2026-06-23T00:00:00.000Z",
    });
  });

  it("creates a heartbeat message without granting command execution", () => {
    const workspaceRoot = path.resolve("D:/project/demo");
    const message = createHeartbeatMessage({
      workspaceRoot,
      runnerId: "runner_test",
      now: "2026-06-23T00:00:05.000Z",
    });

    expect(message).toEqual({
      type: "runner_heartbeat",
      runnerId: "runner_test",
      workspaceRoot,
      status: "online",
      sentAt: "2026-06-23T00:00:05.000Z",
    });
  });
});
