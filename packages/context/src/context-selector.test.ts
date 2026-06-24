import { describe, expect, it } from "vitest";
import { selectContextFiles } from "./context-selector";

describe("selectContextFiles", () => {
  it("prioritizes preferred and keyword-matching files", () => {
    const result = selectContextFiles({
      prompt: "增加登录页面和认证流程",
      preferredPaths: ["apps/web/app/login/page.tsx"],
      maxSelected: 3,
      candidates: [
        { path: "apps/web/app/login/page.tsx", reason: "App route entry" },
        { path: "apps/web/src/components/auth-form.tsx", reason: "Auth component" },
        { path: "packages/shared/src/domain.ts", reason: "Shared contract" },
        { path: "README.md", reason: "Project overview" },
      ],
    });

    expect(result.filesToRead).toEqual([
      "apps/web/app/login/page.tsx",
      "apps/web/src/components/auth-form.tsx",
      "packages/shared/src/domain.ts",
    ]);
    expect(result.selectedFiles[0]).toMatchObject({
      path: "apps/web/app/login/page.tsx",
      relevance: "high",
    });
  });

  it("emits rejected files with explicit reasons", () => {
    const result = selectContextFiles({
      prompt: "修复 runner 心跳",
      maxSelected: 2,
      candidates: [
        { path: "apps/api/src/runner/runner.service.ts", reason: "Runner service" },
        { path: "apps/runner/src/commands/connect.ts", reason: "Runner CLI" },
        { path: "apps/web/src/components/dashboard.tsx", reason: "Dashboard view" },
      ],
    });

    expect(result.selectedFiles).toHaveLength(2);
    expect(result.rejectedFiles).toEqual([
      expect.objectContaining({
        path: "apps/web/src/components/dashboard.tsx",
      }),
    ]);
    expect(result.rejectedFiles[0]?.reason).toContain("当前轮次未进入上下文上限");
  });

  it("falls back to key entry files when prompt signals are weak", () => {
    const result = selectContextFiles({
      prompt: "优化一下",
      maxSelected: 2,
      candidates: [
        { path: "package.json", reason: "Workspace manifest" },
        { path: "tsconfig.json", reason: "TypeScript config" },
        { path: "notes/todo.txt" },
      ],
    });

    expect(result.filesToRead).toEqual(["package.json", "tsconfig.json"]);
    expect(result.selectedFiles.map((file) => file.path)).toEqual(["package.json", "tsconfig.json"]);
  });
});
