import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { RunnerReadResponse, RunnerScanResponse, Workspace, WorkspaceFileSummary } from "@agent-flow/shared";
import { RunnerService } from "../runner/runner.service";
import { RunnerContextClient } from "./runner-context.client";

export type WorkspaceContext = {
  workspaceId: string;
  workspaceRoot: string;
  branch: string;
  topLevelEntries: string[];
  keyFiles: WorkspaceFileSummary[];
  stackHints: string[];
  files: RunnerReadResponse["files"];
};

export type WorkspaceContextReader = Pick<RunnerContextClient, "scanWorkspace" | "readFiles">;

@Injectable()
export class WorkspaceContextService {
  constructor(
    @Inject(RunnerService)
    private readonly runnerService: RunnerService,
    @Inject(RunnerContextClient)
    private readonly runnerContextClient: WorkspaceContextReader,
  ) {}

  async collect(workspace: Workspace): Promise<WorkspaceContext> {
    const session = await this.runnerService.getOnlineSessionForWorkspace(workspace.id);

    if (!session) {
      throw new NotFoundException(`No online runner session found for workspace ${workspace.id}.`);
    }

    const scan = await this.runnerContextClient.scanWorkspace({
      controlBaseUrl: session.controlBaseUrl,
      controlToken: session.controlToken,
      workspaceRoot: workspace.rootPath,
      maxEntries: 200,
      maxDepth: 4,
    });
    const pathsToRead = scan.keyFiles.slice(0, 6).map((file) => file.path);
    const read = pathsToRead.length
      ? await this.runnerContextClient.readFiles({
          controlBaseUrl: session.controlBaseUrl,
          controlToken: session.controlToken,
          workspaceRoot: workspace.rootPath,
          paths: pathsToRead,
        })
      : {
          workspaceRoot: workspace.rootPath,
          files: [],
        };

    return buildWorkspaceContext(workspace, scan, read);
  }
}

export function buildWorkspaceContext(
  workspace: Workspace,
  scan: RunnerScanResponse,
  read: RunnerReadResponse,
): WorkspaceContext {
  if (scan.workspaceRoot !== workspace.rootPath || read.workspaceRoot !== workspace.rootPath) {
    throw new ServiceUnavailableException("Runner returned a mismatched workspace root.");
  }

  return {
    workspaceId: workspace.id,
    workspaceRoot: workspace.rootPath,
    branch: scan.branch,
    topLevelEntries: scan.topLevelEntries,
    keyFiles: scan.keyFiles,
    stackHints: scan.stackHints,
    files: read.files,
  };
}
