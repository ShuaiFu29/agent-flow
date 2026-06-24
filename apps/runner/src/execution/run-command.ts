import { spawn } from "node:child_process";
import path from "node:path";
import { createCommandExecutionPlan } from "../security/command-policy";

export async function runAllowedCommand(input: {
  workspaceRoot: string;
  command: string;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const executionPlan = createCommandExecutionPlan(input.command);
  if (!executionPlan.allowed) {
    throw new Error(executionPlan.reason);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(executionPlan.file, executionPlan.args, {
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
