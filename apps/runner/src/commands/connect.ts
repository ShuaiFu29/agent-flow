import path from "node:path";
import type {
  RunnerControlMessage,
  RunnerCapability,
} from "@agent-flow/shared";

export type ConnectOptions = {
  workspace: string;
  apiUrl: string;
  runnerId: string;
};

export type RegisterMessageInput = {
  workspaceRoot: string;
  runnerId: string;
  now?: string;
};

export const DEFAULT_API_URL = "http://localhost:4000";
export const RUNNER_V0_CAPABILITIES: RunnerCapability[] = [
  "scan_workspace",
  "read_files",
  "run_command",
];

export function parseConnectOptions(argv: string[]): ConnectOptions {
  const options: ConnectOptions = {
    workspace: ".",
    apiUrl: DEFAULT_API_URL,
    runnerId: `runner_${Date.now()}`,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--workspace" || arg === "-w") {
      options.workspace = readOptionValue(argv, ++index, arg);
    } else if (arg === "--api") {
      options.apiUrl = readOptionValue(argv, ++index, arg);
    } else if (arg === "--runner-id") {
      options.runnerId = readOptionValue(argv, ++index, arg);
    } else {
      throw new Error(`Unknown connect option: ${arg}`);
    }
  }

  return options;
}

export function createRegisterMessage(input: RegisterMessageInput): RunnerControlMessage {
  return {
    type: "runner_register",
    runnerId: input.runnerId,
    workspaceRoot: path.resolve(input.workspaceRoot),
    protocolVersion: "v0",
    capabilities: RUNNER_V0_CAPABILITIES,
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function createHeartbeatMessage(input: RegisterMessageInput): RunnerControlMessage {
  return {
    type: "runner_heartbeat",
    runnerId: input.runnerId,
    workspaceRoot: path.resolve(input.workspaceRoot),
    status: "online",
    sentAt: input.now ?? new Date().toISOString(),
  };
}

function readOptionValue(argv: string[], index: number, optionName: string): string {
  const value = argv[index];

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}
