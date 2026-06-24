import { expect, type Page, test } from "@playwright/test";

async function createTaskFromDashboard(page: Page, title: string) {
  await page.goto("/");
  await page.getByTestId("create-task-view-button").click();
  await expect(page.getByTestId("task-title-input")).toBeVisible();
  await expect(page.getByTestId("task-prompt-input")).toBeVisible();

  await page.getByTestId("task-title-input").fill(title);
  await page.getByTestId("task-prompt-input").fill(
    "\u9a8c\u8bc1 V1 \u521b\u5efa\u4efb\u52a1\u3001\u5ba1\u6279\u95e8\u7981\u3001\u4ea7\u7269\u548c\u5ba1\u8ba1\u94fe\u8def\u3002",
  );
  await page.getByTestId("task-submit-button").click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

test("V1 task flow creates a task, keeps it at the approval gate, and exposes artifacts", async ({
  page,
}) => {
  await page.route("http://localhost:4000/**", async (route) => {
    await route.abort();
  });

  const title = `V1 E2E ${Date.now()}`;
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

  const title = `V1 Approval ${Date.now()}`;
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

  await page.goto("/");

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

  await page.goto("/");

  await page.getByTestId("nav-tasks").click();
  await expect(page.getByTestId("task-row")).toHaveCount(1);

  await page.getByTestId("nav-workspace").click();
  await expect(page.getByTestId("workspace-summary")).toContainText("demo-app");

  await page.getByTestId("nav-artifacts").click();
  await expect(page.getByText("patch.diff", { exact: true }).first()).toBeVisible();

  await page.getByTestId("nav-approvals").click();
  await expect(page.getByTestId("approval-summary")).toContainText("patch");

  await page.getByTestId("nav-audit").click();
  await expect(page.getByTestId("audit-log")).toContainText("task_created");

  await page.getByTestId("nav-settings").click();
  await expect(page.getByText("agent-flow", { exact: false }).first()).toBeVisible();
});
