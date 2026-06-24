import { expect, type Page, test } from "@playwright/test";

async function createTaskFromDashboard(page: Page, title: string) {
  await page.goto("/");

  await expect(page.getByTestId("api-status")).toContainText("API online");
  await page.getByTestId("create-task-view-button").click();
  await expect(page.getByRole("heading", { name: "创建开发任务", exact: true })).toBeVisible();

  await page.getByTestId("task-title-input").fill(title);
  await page.getByTestId("task-prompt-input").fill("验证 V1 创建任务、审批门禁、产物和审计链路。");
  await page.getByRole("button", { name: "启动任务", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

test("V1 task flow creates a task, keeps it at the approval gate, and exposes artifacts", async ({
  page,
}) => {
  const title = `V1 E2E ${Date.now()}`;
  await createTaskFromDashboard(page, title);

  await expect(page.getByTestId("timeline-step")).toHaveCount(5);
  await page.getByTestId("artifact-tab-patch").click();
  await expect(page.getByTestId("artifact-content")).toContainText("diff --git");
  await expect(page.getByText("审批门禁", { exact: true })).toBeVisible();
  await expect(page.getByTestId("event-log")).toContainText("approval_requested");
  await expect(page.getByTestId("event-log")).not.toContainText("task_completed");
  await expect(page.getByRole("button", { name: "批准" }).first()).toBeVisible();
});

test("V1 approvals and audit views show pending requests after task creation", async ({ page }) => {
  const title = `V1 Approval ${Date.now()}`;
  await createTaskFromDashboard(page, title);

  await page.getByTestId("nav-approvals").click();
  await expect(page.getByRole("heading", { name: "审批中心", exact: true })).toBeVisible();
  await expect(page.getByTestId("approval-summary")).toContainText("需要确认");
  await expect(page.locator('[data-testid^="approve-"]').first()).toBeVisible();
  await expect(page.getByTestId("approval-summary")).toContainText("pnpm test");

  await page.getByTestId("nav-audit").click();
  await expect(page.getByRole("heading", { name: "审计日志", exact: true })).toBeVisible();
  await expect(page.getByTestId("audit-log")).toContainText("task_created");
  await expect(page.getByTestId("audit-log")).toContainText("approval_requested");
});

test("V1 dashboard falls back to demo mode when the API is unavailable", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  await page.goto("/");

  await expect(page.getByTestId("api-status")).toContainText("demo mode");
  await expect(page.getByTestId("task-row")).toHaveCount(1);
  await page.locator('[data-testid^="task-open-"]').first().click();
  await expect(page.getByTestId("timeline-step")).toHaveCount(5);
  await expect(page.getByTestId("artifact-content")).not.toBeEmpty();
});

test("V1 product skeleton exposes real primary navigation views", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  await page.goto("/");

  const views = [
    ["nav-tasks", "开发任务工作台"],
    ["nav-workspace", "选择工作区"],
    ["nav-artifacts", "产物中心"],
    ["nav-approvals", "审批中心"],
    ["nav-audit", "审计日志"],
    ["nav-settings", "设置"],
  ] as const;

  for (const [testId, title] of views) {
    await page.getByTestId(testId).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }

  await page.getByTestId("nav-workspace").click();
  await expect(page.getByTestId("workspace-summary")).toContainText("demo-app");

  await page.getByTestId("nav-approvals").click();
  await expect(page.getByTestId("approval-summary")).toContainText("patch");

  await page.getByTestId("nav-audit").click();
  await expect(page.getByTestId("audit-log")).toContainText("task_created");
});
