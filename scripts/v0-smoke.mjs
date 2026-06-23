#!/usr/bin/env node

export const REQUIRED_ARTIFACT_KINDS = ["plan", "patch", "review", "test_log", "final_report"];

const DEFAULT_API_BASE_URL = "http://localhost:4000";
const DEFAULT_TITLE = "V0 smoke task";
const DEFAULT_PROMPT = "Verify the V0 task workflow creates events and artifacts.";

export async function createV0TaskFlow({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  title = DEFAULT_TITLE,
  prompt = DEFAULT_PROMPT,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch implementation is available.");
  }

  const baseUrl = normalizeBaseUrl(apiBaseUrl);
  const task = await requestJson(fetchImpl, `${baseUrl}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, prompt }),
  });

  const events = await requestJson(fetchImpl, `${baseUrl}/tasks/${task.id}/events`);
  const artifacts = await requestJson(fetchImpl, `${baseUrl}/tasks/${task.id}/artifacts`);
  const result = { task, events, artifacts };

  validateV0TaskFlow(result);

  return result;
}

export function validateV0TaskFlow({ task, events, artifacts }) {
  const errors = [];

  if (!task || typeof task.id !== "string" || task.id.length === 0) {
    errors.push("Task response must include an id.");
  }

  if (task?.status !== "completed") {
    errors.push(`Expected task status completed, received ${String(task?.status)}.`);
  }

  if (!Array.isArray(events) || events.length === 0) {
    errors.push("Expected at least one task event.");
  }

  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    errors.push("Expected at least one task artifact.");
  }

  if (task?.id && Array.isArray(events)) {
    const mismatchedEvents = events.filter((event) => event.taskId !== task.id);
    if (mismatchedEvents.length > 0) {
      errors.push(`Found ${mismatchedEvents.length} events for a different task id.`);
    }
  }

  if (task?.id && Array.isArray(artifacts)) {
    const mismatchedArtifacts = artifacts.filter((artifact) => artifact.taskId !== task.id);
    if (mismatchedArtifacts.length > 0) {
      errors.push(`Found ${mismatchedArtifacts.length} artifacts for a different task id.`);
    }
  }

  const eventTypes = new Set(Array.isArray(events) ? events.map((event) => event.type) : []);
  for (const requiredEvent of ["task_created", "task_completed"]) {
    if (!eventTypes.has(requiredEvent)) {
      errors.push(`Missing required event: ${requiredEvent}.`);
    }
  }

  const artifactKinds = new Set(
    Array.isArray(artifacts) ? artifacts.map((artifact) => artifact.kind) : [],
  );
  const missingArtifacts = REQUIRED_ARTIFACT_KINDS.filter((kind) => !artifactKinds.has(kind));
  if (missingArtifacts.length > 0) {
    errors.push(`Missing required artifacts: ${missingArtifacts.join(", ")}`);
  }

  const emptyArtifacts = Array.isArray(artifacts)
    ? artifacts.filter((artifact) => !artifact.content || artifact.content.trim().length === 0)
    : [];
  if (emptyArtifacts.length > 0) {
    errors.push(`Found ${emptyArtifacts.length} artifacts without content.`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

async function requestJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);

  if (!response.ok) {
    const body = await readResponseText(response);
    throw new Error(
      `Request failed: ${url} ${response.status} ${response.statusText}${body ? `\n${body}` : ""}`,
    );
  }

  return response.json();
}

async function readResponseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function normalizeBaseUrl(apiBaseUrl) {
  return String(apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function parseCliArgs(argv) {
  const options = {
    apiBaseUrl: process.env.AGENT_FLOW_API_URL ?? DEFAULT_API_BASE_URL,
    title: DEFAULT_TITLE,
    prompt: DEFAULT_PROMPT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--api") {
      options.apiBaseUrl = argv[++index] ?? options.apiBaseUrl;
    } else if (arg === "--title") {
      options.title = argv[++index] ?? options.title;
    } else if (arg === "--prompt") {
      options.prompt = argv[++index] ?? options.prompt;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`agent-flow V0 smoke

Usage:
  pnpm smoke:v0 [--api http://localhost:4000] [--title "..."] [--prompt "..."]

Environment:
  AGENT_FLOW_API_URL  API base URL, defaults to ${DEFAULT_API_BASE_URL}
`);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const result = await createV0TaskFlow(options);
  const artifactKinds = result.artifacts.map((artifact) => artifact.kind).join(", ");

  console.log("V0 smoke passed");
  console.log(`Task: ${result.task.id} (${result.task.status})`);
  console.log(`Events: ${result.events.length}`);
  console.log(`Artifacts: ${artifactKinds}`);
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((error) => {
    console.error("V0 smoke failed");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
