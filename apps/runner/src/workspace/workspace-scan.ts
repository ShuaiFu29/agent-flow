import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  RunnerReadRequest,
  RunnerReadResponse,
  RunnerScanRequest,
  RunnerScanResponse,
  WorkspaceFileSummary,
} from "@agent-flow/shared";
import { evaluateWorkspacePath } from "../security/path-policy";

const execFileAsync = promisify(execFile);
const KEY_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^package\.json$/i, reason: "Workspace manifest" },
  { pattern: /^pnpm-workspace\.ya?ml$/i, reason: "Monorepo workspace config" },
  { pattern: /^tsconfig(\..+)?\.json$/i, reason: "TypeScript config" },
  { pattern: /^README(\..+)?$/i, reason: "Project overview" },
  { pattern: /(^|\/)app\.module\.ts$/i, reason: "Nest module entry" },
  { pattern: /(^|\/)app(\/.+)?\/page\.(t|j)sx?$/i, reason: "App route entry" },
  { pattern: /(^|\/)src\/.+\/index\.(t|j)sx?$/i, reason: "Module entry" },
];

export async function scanWorkspace(input: RunnerScanRequest): Promise<RunnerScanResponse> {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const topLevelEntries = await listAllowedTopLevelEntries(workspaceRoot);
  const collectedFiles: string[] = [];

  await walkDirectory({
    currentPath: workspaceRoot,
    currentDepth: 0,
    maxDepth: input.maxDepth,
    maxEntries: input.maxEntries,
    root: workspaceRoot,
    collectedFiles,
  });

  const keyFiles = await buildKeyFiles(workspaceRoot, collectedFiles);
  const stackHints = await detectStackHints(workspaceRoot, collectedFiles);

  return {
    workspaceRoot,
    branch: await detectBranch(workspaceRoot),
    topLevelEntries,
    keyFiles,
    stackHints,
  };
}

export async function readWorkspaceFiles(input: RunnerReadRequest): Promise<RunnerReadResponse> {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const files = await Promise.all(
    input.paths.map(async (requestedPath) => {
      const evaluation = evaluateWorkspacePath(workspaceRoot, requestedPath);
      if (!evaluation.allowed) {
        throw new Error(evaluation.reason);
      }

      const content = await fs.readFile(evaluation.absolutePath, "utf8");

      return {
        path: evaluation.relativePath,
        content,
      };
    }),
  );

  return {
    workspaceRoot,
    files,
  };
}

async function listAllowedTopLevelEntries(workspaceRoot: string): Promise<string[]> {
  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });

  return entries
    .map((entry) => entry.name)
    .filter((name) => evaluateWorkspacePath(workspaceRoot, name).allowed)
    .sort((left, right) => left.localeCompare(right));
}

async function walkDirectory(input: {
  currentPath: string;
  currentDepth: number;
  maxDepth: number;
  maxEntries: number;
  root: string;
  collectedFiles: string[];
}): Promise<void> {
  if (input.currentDepth > input.maxDepth || input.collectedFiles.length >= input.maxEntries) {
    return;
  }

  const entries = await fs.readdir(input.currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (input.collectedFiles.length >= input.maxEntries) {
      return;
    }

    const absolutePath = path.join(input.currentPath, entry.name);
    const relativePath = path.relative(input.root, absolutePath).replace(/\\/g, "/");
    const evaluation = evaluateWorkspacePath(input.root, relativePath);

    if (!evaluation.allowed) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkDirectory({
        ...input,
        currentPath: absolutePath,
        currentDepth: input.currentDepth + 1,
      });
      continue;
    }

    input.collectedFiles.push(evaluation.relativePath);
  }
}

async function buildKeyFiles(
  workspaceRoot: string,
  files: string[],
): Promise<WorkspaceFileSummary[]> {
  const keyFiles = files.filter((file) =>
    KEY_FILE_PATTERNS.some(({ pattern }) => pattern.test(file)),
  );

  return Promise.all(
    keyFiles.slice(0, 20).map(async (filePath) => {
      const absolutePath = path.join(workspaceRoot, filePath);
      const stat = await fs.stat(absolutePath);
      const reason =
        KEY_FILE_PATTERNS.find(({ pattern }) => pattern.test(filePath))?.reason ?? "Relevant source file";

      return {
        path: filePath,
        size: stat.size,
        reason,
      };
    }),
  );
}

async function detectStackHints(workspaceRoot: string, files: string[]): Promise<string[]> {
  const hints = new Set<string>();

  if (files.includes("pnpm-workspace.yaml") || files.includes("pnpm-lock.yaml")) {
    hints.add("pnpm");
  }

  if (files.some((file) => /^tsconfig(\..+)?\.json$/i.test(path.basename(file)))) {
    hints.add("typescript");
  }

  if (files.some((file) => /(^|\/)app\/.+\/page\.(t|j)sx?$/i.test(file))) {
    hints.add("app-router");
  }

  const packageJsonPath = path.join(workspaceRoot, "package.json");
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
      packageManager?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDependencies = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };

    if (packageJson.packageManager?.startsWith("pnpm")) {
      hints.add("pnpm");
    }
    if ("next" in allDependencies) {
      hints.add("nextjs");
    }
    if ("react" in allDependencies) {
      hints.add("react");
    }
    if ("typescript" in allDependencies) {
      hints.add("typescript");
    }
    if ("@nestjs/common" in allDependencies) {
      hints.add("nestjs");
    }
  } catch {
    // no package.json or invalid JSON; ignore and fall back to filename heuristics
  }

  return Array.from(hints);
}

async function detectBranch(workspaceRoot: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", workspaceRoot, "rev-parse", "--abbrev-ref", "HEAD"]);
    const branch = stdout.trim();
    return branch.length > 0 ? branch : "unknown";
  } catch {
    return "unknown";
  }
}
