import { randomUUID } from "node:crypto";
import path from "node:path";
import { basename } from "node:path";
import type {
  RunnerCapability,
  RunnerControlMessage,
} from "@agent-flow/shared";
import { startRunnerControlServer } from "../control/control-server";
import { heartbeatRunner, registerRunner } from "../runner-api";

export type ConnectOptions = {
  workspace: string;
  apiUrl: string;
  runnerId: string;
};

export type RegisterMessageInput = {
  workspaceRoot: string;
  runnerId: string;
  controlBaseUrl: string;
  controlToken: string;
  now?: string;
};

export type HeartbeatMessageInput = {
  workspaceRoot: string;
  runnerId: string;
  now?: string;
};

export type RunnerApi = {
  registerRunner: typeof registerRunner;
  heartbeatRunner: typeof heartbeatRunner;
};

export type ConnectRuntime = {
  api?: RunnerApi;
  heartbeatIntervalMs?: number;
  log?: (message: string) => void;
  now?: () => string;
  onSignal?: (handler: () => void) => void;
  startControlServer?: typeof startRunnerControlServer;
};

export const DEFAULT_API_URL = "http://localhost:4000";
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000;
export const RUNNER_V1_CAPABILITIES: RunnerCapability[] = [
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

export function createRegisterMessage(input: RegisterMessageInput): Extract<RunnerControlMessage, { type: "runner_register" }> {
  const workspaceRoot = path.resolve(input.workspaceRoot);

  return {
    type: "runner_register",
    runnerId: input.runnerId,
    workspaceRoot,
    workspaceName: basename(workspaceRoot),
    controlBaseUrl: input.controlBaseUrl,
    controlToken: input.controlToken,
    protocolVersion: "v1",
    capabilities: RUNNER_V1_CAPABILITIES,
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function createHeartbeatMessage(input: HeartbeatMessageInput): Extract<RunnerControlMessage, { type: "runner_heartbeat" }> {
  return {
    type: "runner_heartbeat",
    runnerId: input.runnerId,
    workspaceRoot: path.resolve(input.workspaceRoot),
    status: "online",
    sentAt: input.now ?? new Date().toISOString(),
  };
}

export function createRunnerStatusLine(input: {
  runnerId: string;
  workspaceRoot: string;
  apiUrl: string;
  heartbeatIntervalMs: number;
}): string {
  const seconds = Math.max(1, Math.round(input.heartbeatIntervalMs / 1000));

  return `runner ${input.runnerId} connected to ${input.apiUrl} for ${input.workspaceRoot} (heartbeat ${seconds}s)`;
}

export async function runConnectCommand(
  options: ConnectOptions,
  runtime: ConnectRuntime = {},
): Promise<void> {
  const api = runtime.api ?? { registerRunner, heartbeatRunner };
  const heartbeatIntervalMs = runtime.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const log = runtime.log ?? console.log;
  const now = runtime.now ?? (() => new Date().toISOString());
  const workspaceRoot = path.resolve(options.workspace);
  const controlToken = randomUUID();
  const controlServerFactory = runtime.startControlServer ?? startRunnerControlServer;
  const controlServer = await controlServerFactory({
    workspaceRoot,
    token: controlToken,
  });
  const registerMessage = createRegisterMessage({
    workspaceRoot,
    runnerId: options.runnerId,
    controlBaseUrl: controlServer.baseUrl,
    controlToken,
    now: now(),
  });

  await api.registerRunner(options.apiUrl, registerMessage);
  log(
    createRunnerStatusLine({
      runnerId: options.runnerId,
      workspaceRoot,
      apiUrl: options.apiUrl,
      heartbeatIntervalMs,
    }),
  );

  await api.heartbeatRunner(
    options.apiUrl,
    createHeartbeatMessage({
      workspaceRoot,
      runnerId: options.runnerId,
      now: now(),
    }),
  );

  await new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      void api
        .heartbeatRunner(
          options.apiUrl,
          createHeartbeatMessage({
            workspaceRoot,
            runnerId: options.runnerId,
            now: now(),
          }),
        )
        .catch((error: unknown) => {
          clearInterval(interval);
          reject(error);
        });
    }, heartbeatIntervalMs);

    const stop = () => {
      clearInterval(interval);
      void controlServer.close().then(resolve).catch(reject);
    };

    if (runtime.onSignal) {
      runtime.onSignal(stop);
      return;
    }

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

function readOptionValue(argv: string[], index: number, optionName: string): string {
  const value = argv[index];

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}
