import {
  isRunnerCommandAllowed,
  type RunnerAllowedCommand,
} from "@agent-flow/shared";

export type CommandPolicyResult =
  | { allowed: true; command: RunnerAllowedCommand }
  | { allowed: false; reason: string };

export type CommandExecutionPlanResult =
  | { allowed: true; command: RunnerAllowedCommand; file: string; args: string[] }
  | { allowed: false; reason: string };

const SHELL_CONTROL_PATTERN = /[;&|`$<>]/;

export function evaluateRunnerCommand(command: string): CommandPolicyResult {
  const normalizedCommand = command.trim().replace(/\s+/g, " ");

  if (normalizedCommand.length === 0) {
    return { allowed: false, reason: "Command is empty." };
  }

  if (SHELL_CONTROL_PATTERN.test(normalizedCommand)) {
    return { allowed: false, reason: "Shell control operators are not allowed." };
  }

  if (!isRunnerCommandAllowed(normalizedCommand)) {
    return { allowed: false, reason: "Command is not in the runner allowlist." };
  }

  return { allowed: true, command: normalizedCommand };
}

export function createCommandExecutionPlan(command: string): CommandExecutionPlanResult {
  const evaluation = evaluateRunnerCommand(command);
  if (!evaluation.allowed) {
    return evaluation;
  }

  const [file, ...args] = evaluation.command.split(" ");
  if (!file) {
    return { allowed: false, reason: "Command executable is missing." };
  }

  const invocation = resolveCommandInvocation(file, args);

  return {
    allowed: true,
    command: evaluation.command,
    file: invocation.file,
    args: invocation.args,
  };
}

function resolveCommandInvocation(file: string, args: string[]): {
  file: string;
  args: string[];
} {
  if (process.platform !== "win32") {
    return { file, args };
  }

  if (file === "npm" || file === "pnpm") {
    return {
      file: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", `${file}.cmd`, ...args],
    };
  }

  return { file, args };
}
