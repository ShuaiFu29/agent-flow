#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import {
  parseConnectOptions,
  runConnectCommand,
} from "./commands/connect";

export function createCliProgram(): Command {
  const program = new Command();

  program
    .name("agent-flow")
    .description("agent-flow Local Runner")
    .version("0.0.0");

  program
    .command("connect")
    .description("Prepare a conservative local runner registration for a workspace.")
    .option("-w, --workspace <path>", "workspace directory", ".")
    .option("--api <url>", "agent-flow API URL", "http://localhost:4000")
    .option("--runner-id <id>", "stable runner id for this connection")
    .action(async (options: { workspace: string; api: string; runnerId?: string }) => {
      const parsedOptions = parseConnectOptions([
        "--workspace",
        options.workspace,
        "--api",
        options.api,
        "--runner-id",
        options.runnerId ?? `runner_${Date.now()}`,
      ]);
      const workspaceRoot = path.resolve(parsedOptions.workspace);

      if (!fs.existsSync(workspaceRoot)) {
        throw new Error(`Workspace does not exist: ${workspaceRoot}`);
      }

      await runConnectCommand(parsedOptions);
    });

  return program;
}

export function isCliEntrypoint(moduleUrl: string, argvEntry?: string): boolean {
  return Boolean(argvEntry && moduleUrl === pathToFileURL(argvEntry).href);
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  await createCliProgram().parseAsync(process.argv);
}
