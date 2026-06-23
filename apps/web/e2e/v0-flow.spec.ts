import { expect, test } from "@playwright/test";

test("V0 demo flow creates a task and exposes timeline, artifacts, and event log", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("api-status")).toContainText("API online");

  const title = `V0 E2E ${Date.now()}`;
  await page.getByTestId("task-title-input").fill(title);
  await page.getByTestId("task-prompt-input").fill("验证 V0 创建任务、时间线、产物和事件日志。");
  await page.getByTestId("task-submit-button").click();

  await expect(page.getByTestId("task-row").filter({ hasText: title })).toBeVisible();
  await expect(page.getByTestId("timeline-step")).toHaveCount(5);

  await page.getByTestId("artifact-tab-patch").click();
  await expect(page.getByTestId("artifact-content")).toContainText("diff --git");
  await expect(page.getByTestId("event-log")).toContainText("task_completed");
});

test("V0 dashboard falls back to demo mode when the API is unavailable", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  await page.goto("/");

  await expect(page.getByTestId("api-status")).toContainText("demo mode");
  await expect(page.getByTestId("task-row")).toHaveCount(1);
  await expect(page.getByTestId("timeline-step")).toHaveCount(5);
  await expect(page.getByTestId("artifact-content")).not.toBeEmpty();
});

test("V0 product skeleton exposes real primary navigation views", async ({ page }) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  await page.goto("/");

  const views = [
    ["nav-tasks", "任务工作台"],
    ["nav-workspace", "工作区"],
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
