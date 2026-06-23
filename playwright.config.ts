import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm dev:api",
      reuseExistingServer: true,
      timeout: 30_000,
      url: "http://localhost:4000/tasks",
    },
    {
      command: "pnpm --dir apps/web exec next dev --port 3100",
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
      },
      reuseExistingServer: true,
      timeout: 30_000,
      url: "http://localhost:3100",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
