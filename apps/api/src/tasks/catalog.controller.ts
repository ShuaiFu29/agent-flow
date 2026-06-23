import { Controller, Get, Inject } from "@nestjs/common";
import type { Approval, AuditEvent, Workspace } from "@agent-flow/shared";
import { TasksService } from "./tasks.service";

@Controller()
export class CatalogController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Get("workspaces")
  listWorkspaces(): Workspace[] {
    return this.tasksService.listWorkspaces();
  }

  @Get("approvals")
  listApprovals(): Approval[] {
    return this.tasksService.listApprovals();
  }

  @Get("audit")
  listAuditEvents(): AuditEvent[] {
    return this.tasksService.listAuditEvents();
  }
}
