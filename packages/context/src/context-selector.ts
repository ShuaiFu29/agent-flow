import type { ContextSnapshotFile, RejectedContextFile } from "@agent-flow/shared";

export type ContextSelectionCandidate = {
  path: string;
  reason?: string;
  size?: number;
};

export type ContextSelectionInput = {
  prompt: string;
  candidates: ContextSelectionCandidate[];
  preferredPaths?: string[];
  maxSelected?: number;
};

export type ContextSelectionResult = {
  selectedFiles: ContextSnapshotFile[];
  rejectedFiles: RejectedContextFile[];
  filesToRead: string[];
};

type RankedCandidate = {
  candidate: ContextSelectionCandidate;
  score: number;
  reasons: string[];
};

const MAX_SELECTED_DEFAULT = 5;
const KEY_ENTRY_PATTERNS = [
  /(^|\/)package\.json$/i,
  /(^|\/)pnpm-workspace\.ya?ml$/i,
  /(^|\/)tsconfig(\..+)?\.json$/i,
  /(^|\/)README(\..+)?$/i,
  /(^|\/)src\/.+\.(ts|tsx|js|jsx)$/i,
  /(^|\/)app\/.+\/page\.(ts|tsx|js|jsx)$/i,
  /(^|\/)app\.module\.ts$/i,
];

export function selectContextFiles(input: ContextSelectionInput): ContextSelectionResult {
  const maxSelected = input.maxSelected ?? MAX_SELECTED_DEFAULT;
  const preferredPaths = new Set(input.preferredPaths ?? []);
  const promptTokens = tokenizePrompt(input.prompt);

  const ranked = input.candidates.map((candidate) => rankCandidate(candidate, preferredPaths, promptTokens));
  ranked.sort(compareRankedCandidates);

  const selected = ranked.slice(0, maxSelected);
  const rejected = ranked.slice(maxSelected);

  return {
    selectedFiles: selected.map(({ candidate, reasons }, index) => ({
      path: candidate.path,
      reason: formatSelectedReason(reasons),
      relevance: getRelevance(index, selected.length),
    })),
    rejectedFiles: rejected.map(({ candidate, reasons }) => ({
      path: candidate.path,
      reason: formatRejectedReason(reasons),
    })),
    filesToRead: selected.map(({ candidate }) => candidate.path),
  };
}

function rankCandidate(
  candidate: ContextSelectionCandidate,
  preferredPaths: Set<string>,
  promptTokens: string[],
): RankedCandidate {
  let score = 0;
  const reasons: string[] = [];
  const normalizedPath = candidate.path.toLowerCase();
  const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;

  if (preferredPaths.has(candidate.path)) {
    score += 8;
    reasons.push("命中上游优先文件");
  }

  if (KEY_ENTRY_PATTERNS.some((pattern) => pattern.test(candidate.path))) {
    score += 5;
    reasons.push("属于关键入口或配置文件");
  }

  const matchedTokens = promptTokens.filter(
    (token) => normalizedPath.includes(token) || basename.includes(token),
  );
  if (matchedTokens.length > 0) {
    score += matchedTokens.length * 4;
    reasons.push(`命中需求关键词：${matchedTokens.join("、")}`);
  }

  if (candidate.reason) {
    score += 2;
    reasons.push(candidate.reason);
  }

  if (/(\.spec\.|\.test\.)/i.test(candidate.path)) {
    score -= 1;
    reasons.push("测试文件优先级略低于源码入口");
  }

  if (reasons.length === 0) {
    reasons.push("进入候选集，但未命中更强信号");
  }

  return {
    candidate,
    score,
    reasons,
  };
}

function compareRankedCandidates(left: RankedCandidate, right: RankedCandidate): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.candidate.path.localeCompare(right.candidate.path);
}

function formatSelectedReason(reasons: string[]): string {
  return reasons.slice(0, 2).join("；");
}

function formatRejectedReason(reasons: string[]): string {
  return `${reasons.slice(0, 2).join("；")}；当前轮次未进入上下文上限。`;
}

function getRelevance(index: number, total: number): ContextSnapshotFile["relevance"] {
  if (index === 0) {
    return "high";
  }

  if (index < Math.max(2, Math.ceil(total / 2))) {
    return "medium";
  }

  return "low";
}

function tokenizePrompt(prompt: string): string[] {
  return Array.from(
    new Set(
      prompt
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fff]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  );
}
