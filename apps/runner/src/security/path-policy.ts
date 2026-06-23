import path from "node:path";

export type PathPolicyResult =
  | {
      allowed: true;
      absolutePath: string;
      relativePath: string;
    }
  | { allowed: false; reason: string };

const IGNORED_PATH_SEGMENTS = new Set([".git", "node_modules", "dist", "build", ".next"]);
const SENSITIVE_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
]);
const SENSITIVE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx"]);

export function evaluateWorkspacePath(
  workspaceRoot: string,
  requestedPath: string,
): PathPolicyResult {
  const root = path.resolve(workspaceRoot);
  const absolutePath = path.resolve(root, requestedPath);
  const relativePath = normalizeRelativePath(path.relative(root, absolutePath));

  if (relativePath.length === 0) {
    return { allowed: true, absolutePath, relativePath: "." };
  }

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return { allowed: false, reason: "Path resolves outside the workspace." };
  }

  const segments = relativePath.split("/");
  const ignoredSegment = segments.find((segment) => IGNORED_PATH_SEGMENTS.has(segment));
  if (ignoredSegment) {
    return { allowed: false, reason: `Path is inside ignored directory: ${ignoredSegment}.` };
  }

  const fileName = segments.at(-1) ?? "";
  if (SENSITIVE_FILE_NAMES.has(fileName)) {
    return { allowed: false, reason: `Sensitive file is not readable: ${fileName}.` };
  }

  const extension = path.extname(fileName).toLowerCase();
  if (SENSITIVE_EXTENSIONS.has(extension)) {
    return { allowed: false, reason: `Sensitive file extension is not readable: ${extension}.` };
  }

  return { allowed: true, absolutePath, relativePath };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}
