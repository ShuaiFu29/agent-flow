export const RUNNER_ALLOWED_COMMANDS = [
  "pnpm test",
  "npm test",
  "pnpm lint",
  "npm run test",
] as const;

export type RunnerAllowedCommand = (typeof RUNNER_ALLOWED_COMMANDS)[number];

export type RunnerProtocolVersion = "v0";

export type RunnerCapability =
  | "scan_workspace"
  | "read_files"
  | "apply_patch"
  | "run_command";

export type RunnerStatus = "online" | "offline" | "busy";

export function isRunnerCommandAllowed(command: string): command is RunnerAllowedCommand {
  return RUNNER_ALLOWED_COMMANDS.includes(command as RunnerAllowedCommand);
}

export type RunnerControlMessage =
  | {
      type: "runner_register";
      runnerId: string;
      workspaceRoot: string;
      protocolVersion: RunnerProtocolVersion;
      capabilities: RunnerCapability[];
      createdAt: string;
    }
  | {
      type: "runner_heartbeat";
      runnerId: string;
      workspaceRoot: string;
      status: RunnerStatus;
      sentAt: string;
    };

export type RunnerLifecycleEvent =
  | {
      type: "runner_registered";
      runnerId: string;
      workspaceRoot: string;
      accepted: true;
      message: string;
      createdAt: string;
    }
  | {
      type: "runner_rejected";
      runnerId: string;
      workspaceRoot: string;
      accepted: false;
      message: string;
      createdAt: string;
    }
  | {
      type: "runner_disconnected";
      runnerId: string;
      workspaceRoot: string;
      message: string;
      createdAt: string;
    };

export type RunnerCommand =
  | { type: "scan_workspace"; commandId: string; taskId: string }
  | { type: "read_files"; commandId: string; taskId: string; paths: string[] }
  | { type: "apply_patch"; commandId: string; taskId: string; patch: string }
  | {
      type: "run_command";
      commandId: string;
      taskId: string;
      command: RunnerAllowedCommand;
    };

export type RunnerResult =
  | { type: "workspace_scanned"; commandId: string; files: string[] }
  | {
      type: "files_read";
      commandId: string;
      files: Array<{ path: string; content: string }>;
    }
  | { type: "patch_applied"; commandId: string; ok: boolean; message: string }
  | {
      type: "command_output";
      commandId: string;
      stream: "stdout" | "stderr";
      chunk: string;
    }
  | { type: "command_completed"; commandId: string; exitCode: number };
