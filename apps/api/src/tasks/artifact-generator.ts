import { Injectable } from "@nestjs/common";
import type { ArtifactKind } from "@agent-flow/shared";
import type { WorkspaceContext } from "../context/workspace-context.service";

type ArtifactDraft = {
  kind: ArtifactKind;
  title: string;
  content: string;
};

export type GeneratedArtifacts = {
  workspaceSummary: ArtifactDraft;
  plan: ArtifactDraft;
  patch: ArtifactDraft;
  review: ArtifactDraft;
  testLog: ArtifactDraft;
  finalReport: ArtifactDraft;
};

@Injectable()
export class ArtifactGenerator {
  generate(input: {
    taskTitle: string;
    prompt: string;
    workspaceName: string;
    context: WorkspaceContext;
  }): GeneratedArtifacts {
    const focusFiles = pickFocusFiles(input.context);
    const stackLabel = input.context.stackHints.length > 0 ? input.context.stackHints.join(" / ") : "unknown";
    const readSnippets = input.context.files
      .slice(0, 3)
      .map((file) => `- ${file.path}: ${summarizeText(file.content)}`);
    const patchDraft = buildPatchDraft(input, focusFiles);

    return {
      workspaceSummary: {
        kind: "workspace_summary",
        title: "工作区摘要",
        content: [
          `工作区：${input.workspaceName}`,
          `路径：${input.context.workspaceRoot}`,
          `分支：${input.context.branch}`,
          `技术栈：${stackLabel}`,
          `顶层目录：${formatList(input.context.topLevelEntries, "未扫描到顶层目录")}`,
          "关键文件：",
          ...input.context.keyFiles.slice(0, 5).map((file, index) => `${index + 1}. ${file.path} (${file.reason})`),
          ...(readSnippets.length > 0 ? ["已读取片段：", ...readSnippets] : []),
        ].join("\n"),
      },
      plan: {
        kind: "plan",
        title: "实施计划",
        content: [
          `任务：${input.taskTitle}`,
          `需求：${input.prompt}`,
          `工作分支：${input.context.branch}`,
          "建议步骤：",
          `1. 先阅读 ${focusFiles[0] ?? "关键入口文件"}，确认现有实现和需求的切入点。`,
          `2. 围绕 ${formatList(focusFiles.slice(0, 3), "候选关键文件")} 组织最小改动范围，保持 ${stackLabel} 现有模式。`,
          "3. 生成可审批 patch、风险说明和待执行检查命令，并进入审批门禁。",
          `参考文件：${formatList(focusFiles, "无")}`,
        ].join("\n"),
      },
      patch: {
        kind: "patch",
        title: "patch.diff",
        content: patchDraft.content,
      },
      review: {
        kind: "review",
        title: "审查结果",
        content: [
          "结论：当前仅完成真实上下文采集和产物生成，未执行本地写入或命令。",
          "风险点：",
          `- ${focusFiles[0] ?? "目标文件"} 属于当前需求的主要改动入口，修改后需要回归相关任务流。`,
          `- 技术栈包含 ${stackLabel}，需要沿用现有工程约束而不是引入新的运行模式。`,
          "未执行动作：",
          "- apply_patch",
          "- pnpm lint",
          "- pnpm typecheck",
          "- pnpm test",
        ].join("\n"),
      },
      testLog: {
        kind: "test_log",
        title: "测试日志",
        content: [
          "状态：待审批，未执行任何本地检查命令。",
          "计划命令：",
          "- pnpm lint",
          "- pnpm typecheck",
          "- pnpm test",
        ].join("\n"),
      },
      finalReport: {
        kind: "final_report",
        title: "最终报告",
        content: [
          `任务《${input.taskTitle}》已完成真实上下文采集与产物生成。`,
          "当前任务状态：waiting_for_approval",
          `基线分支：${input.context.branch}`,
          `关键文件：${formatList(focusFiles, "无")}`,
          "下一步：等待用户审批 patch 和检查命令，再由 runner 执行本地动作。",
        ].join("\n"),
      },
    };
  }
}

function pickFocusFiles(context: WorkspaceContext): string[] {
  const uniqueFiles = new Set<string>();

  for (const file of context.keyFiles) {
    uniqueFiles.add(file.path);
    if (uniqueFiles.size >= 3) {
      break;
    }
  }

  if (uniqueFiles.size === 0) {
    for (const file of context.files) {
      uniqueFiles.add(file.path);
      if (uniqueFiles.size >= 3) {
        break;
      }
    }
  }

  return Array.from(uniqueFiles);
}

function buildPatchDraft(
  input: {
    taskTitle: string;
    prompt: string;
    workspaceName: string;
    context: WorkspaceContext;
  },
  focusFiles: string[],
): { content: string } {
  const commentableFile = input.context.files.find((file) => isCommentableFile(file.path));

  if (commentableFile) {
    return {
      content: buildInsertionPatch({
        path: commentableFile.path,
        originalContent: commentableFile.content,
        insertedLine: `${getCommentPrefix(commentableFile.path)} agent-flow planned change: ${summarizePrompt(input.prompt)}`,
      }),
    };
  }

  const fallbackPath = `.agent-flow/proposals/${slugify(input.taskTitle)}.md`;
  const nextContent = [
    `# ${input.taskTitle}`,
    "",
    `workspace: ${input.workspaceName}`,
    `branch: ${input.context.branch}`,
    `prompt: ${input.prompt}`,
    "",
    `focus_files: ${formatList(focusFiles, "none")}`,
  ].join("\n");

  return {
    content: buildNewFilePatch({
      path: fallbackPath,
      content: nextContent,
    }),
  };
}

function buildInsertionPatch(input: {
  path: string;
  originalContent: string;
  insertedLine: string;
}): string {
  const originalLines = normalizeLines(input.originalContent);
  const nextLines = [input.insertedLine, ...originalLines];

  if (originalLines.length === 0) {
    return [
      `diff --git a/${input.path} b/${input.path}`,
      `--- a/${input.path}`,
      `+++ b/${input.path}`,
      "@@ -0,0 +1,1 @@",
      `+${input.insertedLine}`,
      "",
    ].join("\n");
  }

  return [
    `diff --git a/${input.path} b/${input.path}`,
    `--- a/${input.path}`,
    `+++ b/${input.path}`,
    `@@ -1,${originalLines.length} +1,${nextLines.length} @@`,
    `+${input.insertedLine}`,
    ...originalLines.map((line) => ` ${line}`),
    "",
  ].join("\n");
}

function buildNewFilePatch(input: { path: string; content: string }): string {
  const lines = normalizeLines(input.content);

  return [
    `diff --git a/${input.path} b/${input.path}`,
    "--- /dev/null",
    `+++ b/${input.path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
    "",
  ].join("\n");
}

function normalizeLines(content: string): string[] {
  const normalized = content.replace(/\r/g, "");
  const withoutTrailingNewline = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;

  return withoutTrailingNewline.length > 0 ? withoutTrailingNewline.split("\n") : [];
}

function isCommentableFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|md)$/i.test(filePath);
}

function getCommentPrefix(filePath: string): string {
  return /\.md$/i.test(filePath) ? "<!--" : "//";
}

function summarizePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 80);
}

function summarizeText(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
}

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
