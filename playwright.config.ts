import { defineConfig, devices } from "@playwright/test";

const apiURL = process.env.AGENT_FLOW_E2E_API_URL ?? "http://localhost:4000";
const webPort = process.env.AGENT_FLOW_E2E_WEB_PORT ?? "3101";
const webURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: webURL,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm dev:api",
      reuseExistingServer: true,
      timeout: 30_000,
      url: `${apiURL}/tasks`,
    },
    {
      command: `pnpm --dir apps/web exec next dev --hostname 127.0.0.1 --port ${webPort}`,
      env: {
        NEXT_PUBLIC_API_URL: apiURL,
      },
      reuseExistingServer: true,
      timeout: 30_000,
      url: webURL,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
