import type {
  RunnerControlMessage,
  RunnerHeartbeatResponse,
  RunnerRegisterResponse,
} from "@agent-flow/shared";

export async function registerRunner(
  apiUrl: string,
  message: Extract<RunnerControlMessage, { type: "runner_register" }>,
): Promise<RunnerRegisterResponse> {
  return postJson<RunnerRegisterResponse>(`${trimTrailingSlash(apiUrl)}/runner/register`, message);
}

export async function heartbeatRunner(
  apiUrl: string,
  message: Extract<RunnerControlMessage, { type: "runner_heartbeat" }>,
): Promise<RunnerHeartbeatResponse> {
  return postJson<RunnerHeartbeatResponse>(`${trimTrailingSlash(apiUrl)}/runner/heartbeat`, message);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Runner API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
