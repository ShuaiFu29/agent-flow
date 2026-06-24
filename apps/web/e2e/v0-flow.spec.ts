import { expect, type Page, test } from "@playwright/test";

async function createTaskFromDashboard(page: Page, title: string) {
  await page.goto("/tasks");
  await page.getByTestId("create-task-view-button").click();
  await expect(page).toHaveURL(/\/tasks\/new$/);
  await expect(page.getByTestId("task-title-input")).toBeVisible();
  await expect(page.getByTestId("task-prompt-input")).toBeVisible();

  await page.getByTestId("task-title-input").fill(title);
  await page.getByTestId("task-prompt-input").fill(
    "\u9a8c\u8bc1 V1 \u521b\u5efa\u4efb\u52a1\u3001\u5ba1\u6279\u95e8\u7981\u3001\u4ea7\u7269\u548c\u5ba1\u8ba1\u94fe\u8def\u3002",
  );
  await page.getByTestId("task-submit-button").click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

async function mockTaskApi(
  page: Page,
  input?: {
    preview?: Record<string, unknown> | null;
  },
) {
  const preview =
    input?.preview === undefined
      ? {
          id: "preview_1",
          taskId: "task_1",
          workspaceId: "workspace_1",
          status: "running",
          url: "http://127.0.0.1:3100",
          port: 3100,
          command: "npm run dev -- --host 127.0.0.1 --port 3100",
          startedAt: "2026-06-24T00:00:00.000Z",
          lastHeartbeatAt: "2026-06-24T00:00:02.000Z",
        }
      : input.preview;

  await page.route("http://localhost:4000/**", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname === "/tasks") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "task_1",
            title: "预览任务",
            prompt: "启动并查看本地预览。",
            status: "waiting_for_approval",
            stage: "verification",
            workspaceId: "workspace_1",
            createdAt: "2026-06-24T00:00:00.000Z",
            updatedAt: "2026-06-24T00:00:00.000Z",
          },
        ]),
      });
      return;
    }

    if (pathname === "/workspaces") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "workspace_1",
            name: "agent-flow-app",
            rootPath: "D:\\project\\agent\\agent-flow",
            status: "online",
            runnerMode: "local",
            branch: "master",
            lastHeartbeatAt: "2026-06-24T00:00:02.000Z",
          },
        ]),
      });
      return;
    }

    if (pathname === "/approvals") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }

    if (pathname === "/audit") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "audit_global_1",
            taskId: "task_1",
            workspaceId: "workspace_1",
            source: "runner",
            action: "preview_started",
            message: "Preview is running.",
            createdAt: "2026-06-24T00:00:02.000Z",
          },
        ]),
      });
      return;
    }

    if (pathname === "/tasks/task_1/events") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "event_1",
            taskId: "task_1",
            type: "approval_requested",
            message: "等待用户审批 pnpm test",
            createdAt: "2026-06-24T00:00:00.000Z",
          },
        ]),
      });
      return;
    }

    if (pathname === "/tasks/task_1/artifacts") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "artifact_1",
            taskId: "task_1",
            kind: "plan",
            title: "实现计划",
            content: "1. 启动 dev server\n2. 打开预览\n3. 验证页面输出",
            createdAt: "2026-06-24T00:00:00.000Z",
          },
        ]),
      });
      return;
    }

    if (pathname === "/tasks/task_1/approvals") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
      return;
    }

    if (pathname === "/tasks/task_1/audit") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "audit_1",
            taskId: "task_1",
            workspaceId: "workspace_1",
            source: "runner",
            action: preview && preview.status === "failed" ? "preview_failed" : "preview_started",
            message: preview && "failureMessage" in preview ? preview.failureMessage : "Preview is running.",
            createdAt: "2026-06-24T00:00:02.000Z",
          },
        ]),
      });
      return;
    }

    if (pathname === "/tasks/task_1/source") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "source_1",
          taskId: "task_1",
          kind: "manual",
          title: "预览任务",
          content: "启动并查看本地预览。",
          createdAt: "2026-06-24T00:00:00.000Z",
        }),
      });
      return;
    }

    if (pathname === "/tasks/task_1/context") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "snapshot_1",
          taskId: "task_1",
          selectedFiles: [{ path: "apps/web/app/page.tsx", reason: "首页入口", relevance: "high" }],
          rejectedFiles: [{ path: ".env.local", reason: "敏感文件" }],
          createdAt: "2026-06-24T00:00:00.000Z",
        }),
      });
      return;
    }

    if (pathname === "/tasks/task_1/patch-lifecycle") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "patch_1",
          taskId: "task_1",
          patchArtifactId: "artifact_1",
          status: "applied",
          precheck: {
            status: "passed",
            changedFiles: ["apps/web/app/page.tsx"],
            message: "Patch precheck passed.",
            issues: [],
            checkedAt: "2026-06-24T00:00:00.000Z",
          },
          applyResult: {
            status: "applied",
            changedFiles: ["apps/web/app/page.tsx"],
            message: "Patch applied.",
          },
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:01.000Z",
        }),
      });
      return;
    }

    if (pathname === "/tasks/task_1/command-runs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "command_1",
            taskId: "task_1",
            command: "pnpm test",
            status: "passed",
            exitCode: 0,
            stdout: "ok",
            stderr: "",
            createdAt: "2026-06-24T00:00:00.000Z",
            updatedAt: "2026-06-24T00:00:02.000Z",
            startedAt: "2026-06-24T00:00:01.000Z",
            completedAt: "2026-06-24T00:00:02.000Z",
          },
        ]),
      });
      return;
    }

    if (pathname === "/tasks/task_1/preview") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(preview),
      });
      return;
    }

    if (pathname === "/tasks/task_1/stream") {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "",
      });
      return;
    }

    if (pathname === "/tasks/task_1") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "task_1",
          title: "预览任务",
          prompt: "启动并查看本地预览。",
          status: "waiting_for_approval",
          stage: "verification",
          workspaceId: "workspace_1",
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
        }),
      });
      return;
    }

    await route.abort();
  });
}

test("V1 task flow creates a task, keeps it at the approval gate, and exposes artifacts", async ({
  page,
}) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  const title = `V1 端到端任务 ${Date.now()}`;
  await createTaskFromDashboard(page, title);

  const selectedItems = page.getByTestId("context-selected-list").locator("li");
  const rejectedItems = page.getByTestId("context-rejected-list").locator("li");

  await expect(page.getByTestId("timeline-step")).toHaveCount(5);
  await expect(page.getByTestId("patch-lifecycle")).toBeVisible();
  await expect(page.getByTestId("patch-lifecycle")).toContainText("Patch");
  await expect(page.getByTestId("task-stage")).toContainText("等待补丁审批");
  await expect(page.getByTestId("command-runs")).toBeVisible();
  await expect(page.getByTestId("command-runs")).toContainText("pnpm test");
  await expect(page.getByTestId("patch-lifecycle-files")).toContainText("apps/web/app/login/page.tsx");
  await expect(page.getByTestId("context-snapshot")).toBeVisible();
  await expect(selectedItems.first()).toBeVisible();
  await expect(rejectedItems.first()).toBeVisible();
  await page.getByTestId("artifact-tab-patch").click();
  await expect(page.getByTestId("artifact-content")).toContainText("diff --git");
  await expect(page.getByTestId("event-log")).toContainText("approval_requested");
  await expect(page.getByTestId("event-log")).not.toContainText("task_completed");
});

test("V1 approvals and audit views show pending requests after task creation", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  const title = `V1 审批任务 ${Date.now()}`;
  await createTaskFromDashboard(page, title);

  await page.getByTestId("nav-approvals").click();
  await expect(page.getByTestId("approval-summary")).toBeVisible();
  await expect(page.locator('[data-testid^="approve-"]').first()).toBeVisible();
  await expect(page.getByTestId("approval-summary")).toContainText("pnpm test");

  await page.getByTestId("nav-audit").click();
  await expect(page.getByTestId("audit-log")).toBeVisible();
  await expect(page.getByTestId("audit-log")).toContainText("task_created");
  await expect(page.getByTestId("audit-log")).toContainText("approval_requested");
});

test("V1 dashboard falls back to demo mode when the API is unavailable", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  await page.goto("/tasks");

  await expect(page.getByTestId("api-status")).toContainText("demo mode");
  await expect(page.getByTestId("task-row")).toHaveCount(1);
  await page.locator('[data-testid^="task-open-"]').first().click();
  await expect(page.getByTestId("timeline-step")).toHaveCount(5);
  await expect(page.getByTestId("task-stage")).toContainText("等待补丁审批");
  await expect(page.getByTestId("command-runs")).toContainText("pnpm test");
  await expect(page.getByTestId("artifact-content")).not.toBeEmpty();
});

test("V1 product skeleton exposes real primary navigation views", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  await page.goto("/tasks");

  await page.getByTestId("nav-tasks").click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByTestId("task-row")).toHaveCount(1);

  await page.getByTestId("nav-workspace").click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByTestId("workspace-summary")).toContainText("demo-app");

  await page.getByTestId("nav-artifacts").click();
  await expect(page).toHaveURL(/\/artifacts$/);
  await expect(page.getByText("patch.diff", { exact: true }).first()).toBeVisible();

  await page.getByTestId("nav-approvals").click();
  await expect(page).toHaveURL(/\/approvals$/);
  await expect(page.getByTestId("approval-summary")).toContainText("patch");

  await page.getByTestId("nav-audit").click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(page.getByTestId("audit-log")).toContainText("task_created");

  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("agent-flow", { exact: false }).first()).toBeVisible();
});

test("console shell stays mounted while switching primary routes", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  await page.goto("/tasks");
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.locator(".app-shell").evaluate((element) => {
    element.setAttribute("data-persistence-probe", "stable");
  });

  await page.getByTestId("nav-workspace").click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.locator(".app-shell")).toHaveAttribute("data-persistence-probe", "stable");

  await page.getByTestId("nav-artifacts").click();
  await expect(page).toHaveURL(/\/artifacts$/);
  await expect(page.locator(".app-shell")).toHaveAttribute("data-persistence-probe", "stable");
});

test("V2.5 preview panel renders a running preview session from the API", async ({ page }) => {
  await mockTaskApi(page);

  await page.goto("/tasks");
  await page.locator('[data-testid^="task-open-"]').first().click();

  await expect(page.getByTestId("preview-panel")).toBeVisible();
  await expect(page.getByTestId("preview-status")).toContainText("运行中");
  await expect(page.getByTestId("preview-url")).toContainText("http://127.0.0.1:3100");
  await expect(page.getByTestId("preview-open")).toBeVisible();
});

test("V2.5 preview panel shows failed and empty states without layout breakage", async ({ page }) => {
  await mockTaskApi(page, {
    preview: {
      id: "preview_1",
      taskId: "task_1",
      workspaceId: "workspace_1",
      status: "failed",
      url: "http://127.0.0.1:3100",
      port: 3100,
      command: "npm run dev -- --host 127.0.0.1 --port 3100",
      startedAt: "2026-06-24T00:00:00.000Z",
      lastHeartbeatAt: "2026-06-24T00:00:03.000Z",
      failureMessage: "Dev server exited unexpectedly.",
    },
  });

  await page.goto("/tasks");
  await page.locator('[data-testid^="task-open-"]').first().click();
  await expect(page.getByTestId("preview-panel")).toContainText("启动失败");
  await expect(page.getByTestId("preview-panel")).toContainText("Dev server exited unexpectedly.");
  await expect(page.getByTestId("preview-start")).toBeVisible();

  await page.unroute("http://localhost:4000/**");
  await mockTaskApi(page, { preview: null });
  await page.reload();
  await expect(page.getByTestId("preview-empty")).toBeVisible();
  await expect(page.getByTestId("preview-empty")).toContainText("还没有预览会话");
});

test("V2.5 full-screen preview route embeds the preview URL", async ({ page }) => {
  await mockTaskApi(page);
  await page.route("http://127.0.0.1:3100/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><html><body><h1>preview ok</h1></body></html>",
    });
  });

  await page.goto("/preview/task_1");

  await expect(page.locator("iframe")).toHaveAttribute("src", "http://127.0.0.1:3100");
  await expect(page.getByText("预览任务")).toBeVisible();
});
