import { describe, expect, it } from "vitest";
import type { WorkspaceContext } from "../context/workspace-context.service";
import { ArtifactGenerator } from "./artifact-generator";

describe("ArtifactGenerator", () => {
  it("generates traceable Phase B artifacts from the real workspace context", () => {
    const generator = new ArtifactGenerator();
    const context: WorkspaceContext = {
      workspaceId: "workspace_agent_flow",
      workspaceRoot: "D:\\project\\agent\\agent-flow",
      branch: "feat/v1-workspace-runner",
      topLevelEntries: ["apps", "packages", "package.json"],
      keyFiles: [
        { path: "package.json", size: 180, reason: "Workspace manifest" },
        { path: "apps/api/src/tasks/tasks.service.ts", size: 2048, reason: "Task orchestration entry" },
        { path: "apps/web/src/components/dashboard.tsx", size: 4096, reason: "Primary operator console" },
      ],
      stackHints: ["pnpm", "typescript", "nestjs", "nextjs"],
      files: [
        {
          path: "package.json",
          content: JSON.stringify({ name: "agent-flow", packageManager: "pnpm@10.14.0" }),
        },
        {
          path: "apps/api/src/tasks/tasks.service.ts",
          content: "export class TasksService {}\n",
        },
      ],
    };

    const artifacts = generator.generate({
      taskTitle: "将任务工作流切换到真实上下文产物",
      prompt: "让任务产物基于真实 workspace 上下文生成，并停止伪造命令执行成功。",
      workspaceName: "agent-flow",
      context,
    });

    expect(artifacts.workspaceSummary.content).toContain("feat/v1-workspace-runner");
    expect(artifacts.workspaceSummary.content).toContain("apps/api/src/tasks/tasks.service.ts");
    expect(artifacts.workspaceSummary.content).toContain("typescript");

    expect(artifacts.plan.content).toContain("让任务产物基于真实 workspace 上下文生成");
    expect(artifacts.plan.content).toContain("apps/api/src/tasks/tasks.service.ts");
    expect(artifacts.plan.content).not.toContain("生成最小可审查补丁");

    expect(artifacts.patch.content).toContain(
      "diff --git a/apps/api/src/tasks/tasks.service.ts b/apps/api/src/tasks/tasks.service.ts",
    );
    expect(artifacts.patch.content).toContain("--- a/apps/api/src/tasks/tasks.service.ts");
    expect(artifacts.patch.content).toContain("+++ b/apps/api/src/tasks/tasks.service.ts");
    expect(artifacts.patch.content).toContain("agent-flow planned change");

    expect(artifacts.review.content).toContain("未执行");
    expect(artifacts.review.content).toContain("pnpm lint");
    expect(artifacts.review.content).toContain("pnpm typecheck");
    expect(artifacts.review.content).toContain("pnpm test");

    expect(artifacts.testLog.content).toContain("待审批");
    expect(artifacts.finalReport.content).toContain("waiting_for_approval");
  });
});
