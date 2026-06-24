import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import type { Approval, AuditEvent, RunnerSession, Workspace } from "@agent-flow/shared";
import { RunnerService } from "../runner/runner.service";
import { TasksService } from "./tasks.service";

@Controller()
export class CatalogController {
  constructor(
    @Inject(TasksService) private readonly tasksService: TasksService,
    @Inject(RunnerService) private readonly runnerService: RunnerService,
  ) {}

  @Get("workspaces")
  listWorkspaces(): Promise<Workspace[]> {
    return this.runnerService.listWorkspaces();
  }

  @Get("runner-sessions")
  listRunnerSessions(): Promise<RunnerSession[]> {
    return this.runnerService.listRunnerSessions();
  }

  @Get("approvals")
  listApprovals(): Promise<Approval[]> {
    return this.tasksService.listApprovals();
  }

  @Post("approvals/:approvalId/approve")
  @HttpCode(HttpStatus.CREATED)
  approveApproval(@Param("approvalId") approvalId: string): Promise<Approval> {
    return this.tasksService.approveApproval(approvalId);
  }

  @Post("approvals/:approvalId/reject")
  @HttpCode(HttpStatus.CREATED)
  rejectApproval(@Param("approvalId") approvalId: string): Promise<Approval> {
    return this.tasksService.rejectApproval(approvalId);
  }

  @Get("audit")
  listAuditEvents(): Promise<AuditEvent[]> {
    return this.tasksService.listAuditEvents();
  }
}
