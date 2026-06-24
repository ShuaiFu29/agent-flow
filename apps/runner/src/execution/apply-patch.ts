import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { RunnerPatchOperationResponse } from "@agent-flow/shared";
import { inspectPatchPaths } from "../security/path-policy";

const execFileAsync = promisify(execFile);

export async function precheckWorkspacePatch(input: {
  workspaceRoot: string;
  patch: string;
}): Promise<RunnerPatchOperationResponse> {
  const extractedPaths = inspectPatchPaths(input.workspaceRoot, input.patch);
  if (!extractedPaths.allowed) {
    return {
      ok: false,
      message: extractedPaths.reason,
      changedFiles: extractedPaths.changedFiles,
      failureCode: "path_not_allowed",
      issues: [
        {
          code: "path_not_allowed",
          message: extractedPaths.reason,
          path: extractedPaths.path,
        },
      ],
    };
  }

  const changedFiles = extractedPaths.changedFiles;
  if (changedFiles.length === 0) {
    return {
      ok: false,
      message: "Patch does not contain any allowed workspace paths.",
      changedFiles: [],
      failureCode: "empty_patch",
      issues: [
        {
          code: "empty_patch",
          message: "Patch does not contain any allowed workspace paths.",
        },
      ],
    };
  }

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-runner-patch-"));
  const patchPath = path.join(tempDirectory, "approval.patch");

  try {
    await fs.writeFile(patchPath, input.patch, "utf8");
    await execFileAsync("git", ["apply", "--check", patchPath], {
      cwd: path.resolve(input.workspaceRoot),
      windowsHide: true,
    });

    return {
      ok: true,
      message: `Patch precheck passed for ${changedFiles.length} file(s).`,
      changedFiles,
      issues: [],
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      changedFiles,
      failureCode: "patch_check_failed",
      issues: [
        {
          code: "patch_check_failed",
          message: getErrorMessage(error),
        },
      ],
    };
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function applyWorkspacePatch(input: {
  workspaceRoot: string;
  patch: string;
}): Promise<RunnerPatchOperationResponse> {
  const precheck = await precheckWorkspacePatch(input);
  if (!precheck.ok) {
    return precheck;
  }

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-runner-patch-"));
  const patchPath = path.join(tempDirectory, "approval.patch");

  try {
    await fs.writeFile(patchPath, input.patch, "utf8");
    await execFileAsync("git", ["apply", patchPath], {
      cwd: path.resolve(input.workspaceRoot),
      windowsHide: true,
    });

    return {
      ok: true,
      message: `Patch applied to ${precheck.changedFiles.length} file(s).`,
      changedFiles: precheck.changedFiles,
      issues: [],
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
      changedFiles: precheck.changedFiles,
      failureCode: "patch_apply_failed",
      issues: [
        {
          code: "patch_apply_failed",
          message: getErrorMessage(error),
        },
      ],
    };
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown patch operation failure.";
}
