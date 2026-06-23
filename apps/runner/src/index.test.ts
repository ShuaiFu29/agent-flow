import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isCliEntrypoint } from "./index";

describe("runner CLI entrypoint", () => {
  it("detects when the current module is the process entrypoint", () => {
    const entryPath = path.resolve("apps/runner/src/index.ts");

    expect(isCliEntrypoint(pathToFileURL(entryPath).href, entryPath)).toBe(true);
  });

  it("does not run when imported by another module", () => {
    const entryPath = path.resolve("apps/runner/src/index.ts");
    const importedUrl = pathToFileURL(path.resolve("apps/runner/src/index.test.ts")).href;

    expect(isCliEntrypoint(importedUrl, entryPath)).toBe(false);
  });
});
