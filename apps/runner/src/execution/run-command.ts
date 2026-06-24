import { spawn } from "node:child_process";
import path from "node:path";
import { evaluateRunnerCommand } from "../security/command-policy";

export async function runAllowedCommand(input: {
  workspaceRoot: string;
  command: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const evaluation = evaluateRunnerCommand(input.command);
  if (!evaluation.allowed) {
    throw new Error(evaluation.reason);
  }

  const [file, ...args] = evaluation.command.split(" ");
  if (!file) {
    throw new Error("Command executable is missing.");
  }
  const invocation = resolveCommandInvocation(file, args);

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.file, invocation.args, {
      cwd: path.resolve(input.workspaceRoot),
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
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
