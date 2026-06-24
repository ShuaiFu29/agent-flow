import http from "node:http";
import type { AddressInfo } from "node:net";
import { applyWorkspacePatch } from "../execution/apply-patch";
import { runAllowedCommand } from "../execution/run-command";
import { readWorkspaceFiles, scanWorkspace } from "../workspace/workspace-scan";

export async function startRunnerControlServer(input: {
  workspaceRoot: string;
  token: string;
}): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer(async (request, response) => {
    try {
      if (!isAuthorized(request.headers.authorization, input.token)) {
        writeJson(response, 401, { message: "Unauthorized" });
        return;
      }

      if (request.method !== "POST") {
        writeJson(response, 405, { message: "Method Not Allowed" });
        return;
      }

      if (request.url === "/workspace/scan") {
        const body = (await readJsonBody(request)) as {
          workspaceRoot: string;
          maxEntries: number;
          maxDepth: number;
        };
        const result = await scanWorkspace({
          workspaceRoot: body.workspaceRoot,
          maxEntries: body.maxEntries,
          maxDepth: body.maxDepth,
        });
        writeJson(response, 200, result);
        return;
      }

      if (request.url === "/workspace/read") {
        const body = (await readJsonBody(request)) as {
          workspaceRoot: string;
          paths: string[];
        };
        const result = await readWorkspaceFiles({
          workspaceRoot: body.workspaceRoot,
          paths: body.paths,
        });
        writeJson(response, 200, result);
        return;
      }

      if (request.url === "/patch/apply") {
        const body = (await readJsonBody(request)) as {
          workspaceRoot: string;
          patch: string;
        };
        const result = await applyWorkspacePatch({
          workspaceRoot: body.workspaceRoot,
          patch: body.patch,
        });
        writeJson(response, 200, result);
        return;
      }

      if (request.url === "/commands/run") {
        const body = (await readJsonBody(request)) as {
          workspaceRoot: string;
          command: string;
        };
        const result = await runAllowedCommand({
          workspaceRoot: body.workspaceRoot,
          command: body.command,
        });
        writeJson(response, 200, result);
        return;
      }

      writeJson(response, 404, { message: "Not Found" });
    } catch (error) {
      writeJson(response, 400, {
        message: error instanceof Error ? error.message : "Runner control error",
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Runner control server did not expose a TCP address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

function isAuthorized(authorizationHeader: string | undefined, token: string): boolean {
  return authorizationHeader === `Bearer ${token}`;
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body.length === 0 ? {} : JSON.parse(body);
}

function writeJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}
