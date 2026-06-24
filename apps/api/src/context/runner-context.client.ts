import type {
  RunnerPatchOperationResponse,
  RunnerReadResponse,
  RunnerScanResponse,
} from "@agent-flow/shared";

export class RunnerContextClient {
  async scanWorkspace(input: {
    controlBaseUrl: string;
    controlToken: string;
    workspaceRoot: string;
    maxEntries: number;
    maxDepth: number;
  }): Promise<RunnerScanResponse> {
    return this.postJson<RunnerScanResponse>(`${trimTrailingSlash(input.controlBaseUrl)}/workspace/scan`, input.controlToken, {
      workspaceRoot: input.workspaceRoot,
      maxEntries: input.maxEntries,
      maxDepth: input.maxDepth,
    });
  }

  async readFiles(input: {
    controlBaseUrl: string;
    controlToken: string;
    workspaceRoot: string;
    paths: string[];
  }): Promise<RunnerReadResponse> {
    return this.postJson<RunnerReadResponse>(`${trimTrailingSlash(input.controlBaseUrl)}/workspace/read`, input.controlToken, {
      workspaceRoot: input.workspaceRoot,
      paths: input.paths,
    });
  }

  async applyPatch(input: {
    controlBaseUrl: string;
    controlToken: string;
    workspaceRoot: string;
    patch: string;
  }): Promise<RunnerPatchOperationResponse> {
    return this.postJson<RunnerPatchOperationResponse>(`${trimTrailingSlash(input.controlBaseUrl)}/patch/apply`, input.controlToken, {
      workspaceRoot: input.workspaceRoot,
      patch: input.patch,
    });
  }

  async precheckPatch(input: {
    controlBaseUrl: string;
    controlToken: string;
    workspaceRoot: string;
    patch: string;
  }): Promise<RunnerPatchOperationResponse> {
    return this.postJson<RunnerPatchOperationResponse>(`${trimTrailingSlash(input.controlBaseUrl)}/patch/precheck`, input.controlToken, {
      workspaceRoot: input.workspaceRoot,
      patch: input.patch,
    });
  }

  async runCommand(input: {
    controlBaseUrl: string;
    controlToken: string;
    workspaceRoot: string;
    command: string;
  }): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return this.postJson(`${trimTrailingSlash(input.controlBaseUrl)}/commands/run`, input.controlToken, {
      workspaceRoot: input.workspaceRoot,
      command: input.command,
    });
  }

  private async postJson<T>(url: string, token: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Runner context request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
