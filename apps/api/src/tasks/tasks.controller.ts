import { Body, Controller, Get, Inject, Param, Post, Sse } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import type { AgentFlowEvent, Approval, Artifact, AuditEvent, Task, TaskSource } from "@agent-flow/shared";
import { TasksService } from "./tasks.service";

type CreateTaskBody = {
  title: string;
  prompt: string;
};

@Controller("tasks")
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Post()
  createTask(@Body() body: CreateTaskBody): Task {
    return this.tasksService.createTask(body);
  }

  @Get()
  listTasks(): Task[] {
    return this.tasksService.listTasks();
  }

  @Get(":taskId")
  getTask(@Param("taskId") taskId: string): Task {
    return this.tasksService.getTask(taskId);
  }

  @Get(":taskId/events")
  listEvents(@Param("taskId") taskId: string): AgentFlowEvent[] {
    return this.tasksService.listEvents(taskId);
  }

  @Get(":taskId/artifacts")
  listArtifacts(@Param("taskId") taskId: string): Artifact[] {
    return this.tasksService.listArtifacts(taskId);
  }

  @Get(":taskId/approvals")
  listApprovals(@Param("taskId") taskId: string): Approval[] {
    return this.tasksService.listApprovals(taskId);
  }

  @Get(":taskId/audit")
  listAuditEvents(@Param("taskId") taskId: string): AuditEvent[] {
    return this.tasksService.listAuditEvents(taskId);
  }

  @Get(":taskId/source")
  getTaskSource(@Param("taskId") taskId: string): TaskSource {
    return this.tasksService.getTaskSource(taskId);
  }

  @Sse(":taskId/stream")
  streamEvents(@Param("taskId") taskId: string): Observable<MessageEvent> {
    return this.tasksService.streamEvents(taskId);
  }
}
