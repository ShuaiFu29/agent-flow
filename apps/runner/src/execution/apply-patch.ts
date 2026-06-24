import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { evaluateWorkspacePath } from "../security/path-policy";

const execFileAsync = promisify(execFile);
const DIFF_PATH_PATTERN = /^(?:diff --git a\/(.+?) b\/(.+)|--- a\/(.+)|\+\+\+ b\/(.+))$/;

export async function applyWorkspacePatch(input: {
  workspaceRoot: string;
  patch: string;
}): Promise<{ ok: true; message: string; changedFiles: string[] }> {
  const changedFiles = extractPatchPaths(input.workspaceRoot, input.patch);
  if (changedFiles.length === 0) {
    throw new Error("Patch does not contain any allowed workspace paths.");
  }

  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "agent-flow-runner-patch-"));
  const patchPath = path.join(tempDirectory, "approval.patch");

  try {
    await fs.writeFile(patchPath, input.patch, "utf8");
    await execFileAsync("git", ["apply", "--check", patchPath], {
      cwd: path.resolve(input.workspaceRoot),
      windowsHide: true,
    });
    await execFileAsync("git", ["apply", patchPath], {
      cwd: path.resolve(input.workspaceRoot),
      windowsHide: true,
    });

    return {
      ok: true,
      message: `Patch applied to ${changedFiles.length} file(s).`,
      changedFiles,
    };
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

function extractPatchPaths(workspaceRoot: string, patch: string): string[] {
  const changedFiles = new Set<string>();

  for (const line of patch.split(/\r?\n/)) {
    const match = line.match(DIFF_PATH_PATTERN);
    if (!match) {
      continue;
    }

    const candidates = [match[2], match[4], match[1], match[3]].filter(
      (value): value is string => Boolean(value && value !== "/dev/null"),
    );

    for (const candidate of candidates) {
      const evaluation = evaluateWorkspacePath(workspaceRoot, candidate);
      if (!evaluation.allowed) {
        throw new Error(evaluation.reason);
      }

      changedFiles.add(evaluation.relativePath);
    }
  }

  return Array.from(changedFiles);
}
