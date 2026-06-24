import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const appDir = join(process.cwd(), "app");

describe("web app routes", () => {
  test("primary console surfaces share a persistent route group layout", () => {
    expect(existsSync(join(appDir, "(console)/layout.tsx"))).toBe(true);

    const routePages = [
      "(console)/tasks/page.tsx",
      "(console)/tasks/new/page.tsx",
      "(console)/tasks/[taskId]/page.tsx",
      "(console)/workspaces/page.tsx",
      "(console)/artifacts/page.tsx",
      "(console)/approvals/page.tsx",
      "(console)/audit/page.tsx",
      "(console)/settings/page.tsx",
      "preview/[taskId]/page.tsx",
    ];

    expect(routePages.filter((routePage) => !existsSync(join(appDir, routePage)))).toEqual([]);
  });

  test("console route pages do not mount separate dashboard instances", () => {
    const legacyRoutePages = [
      "tasks/page.tsx",
      "tasks/new/page.tsx",
      "tasks/[taskId]/page.tsx",
      "workspaces/page.tsx",
      "artifacts/page.tsx",
      "approvals/page.tsx",
      "audit/page.tsx",
      "settings/page.tsx",
    ];

    expect(legacyRoutePages.filter((routePage) => existsSync(join(appDir, routePage)))).toEqual([]);
  });
});
