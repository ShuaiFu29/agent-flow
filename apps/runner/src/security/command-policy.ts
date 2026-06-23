import {
  isRunnerCommandAllowed,
  type RunnerAllowedCommand,
} from "@agent-flow/shared";

export type CommandPolicyResult =
  | { allowed: true; command: RunnerAllowedCommand }
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
