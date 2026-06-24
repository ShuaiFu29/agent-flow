import { Body, Controller, Get, Inject, Param, Post, Sse } from "@nestjs/common";
import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import type {
  AgentFlowEvent,
  Approval,
  Artifact,
  AuditEvent,
  CommandRun,
  ContextSnapshot,
  PatchLifecycle,
  PreviewSession,
  Task,
  TaskSource,
} from "@agent-flow/shared";
import { TasksService } from "./tasks.service";

type CreateTaskBody = {
  title: string;
  prompt: string;
};

@Controller("tasks")
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Post()
  createTask(@Body() body: CreateTaskBody): Promise<Task> {
    return this.tasksService.createTask(body);
  }

  @Get()
  listTasks(): Promise<Task[]> {
    return this.tasksService.listTasks();
  }

  @Get(":taskId")
  getTask(@Param("taskId") taskId: string): Promise<Task> {
    return this.tasksService.getTask(taskId);
  }

  @Get(":taskId/events")
  listEvents(@Param("taskId") taskId: string): Promise<AgentFlowEvent[]> {
    return this.tasksService.listEvents(taskId);
  }

  @Get(":taskId/artifacts")
  listArtifacts(@Param("taskId") taskId: string): Promise<Artifact[]> {
    return this.tasksService.listArtifacts(taskId);
  }

  @Get(":taskId/approvals")
  listApprovals(@Param("taskId") taskId: string): Promise<Approval[]> {
    return this.tasksService.listApprovals(taskId);
  }

  @Get(":taskId/audit")
  listAuditEvents(@Param("taskId") taskId: string): Promise<AuditEvent[]> {
    return this.tasksService.listAuditEvents(taskId);
  }

  @Get(":taskId/source")
  getTaskSource(@Param("taskId") taskId: string): Promise<TaskSource> {
    return this.tasksService.getTaskSource(taskId);
  }

  @Get(":taskId/context")
  getContextSnapshot(@Param("taskId") taskId: string): Promise<ContextSnapshot> {
    return this.tasksService.getContextSnapshot(taskId);
  }

  @Get(":taskId/patch-lifecycle")
  getPatchLifecycle(@Param("taskId") taskId: string): Promise<PatchLifecycle> {
    return this.tasksService.getPatchLifecycle(taskId);
  }

  @Get(":taskId/command-runs")
  listCommandRuns(@Param("taskId") taskId: string): Promise<CommandRun[]> {
    return this.tasksService.listCommandRuns(taskId);
  }

  @Get(":taskId/preview")
  getPreviewSession(@Param("taskId") taskId: string): Promise<PreviewSession | null> {
    return this.tasksService.getPreviewSession(taskId);
  }

  @Post(":taskId/preview/start")
  startPreview(@Param("taskId") taskId: string): Promise<PreviewSession> {
    return this.tasksService.startPreview(taskId);
  }

  @Post(":taskId/preview/stop")
  stopPreview(@Param("taskId") taskId: string): Promise<PreviewSession | null> {
    return this.tasksService.stopPreview(taskId);
  }

  @Post(":taskId/preview/restart")
  restartPreview(@Param("taskId") taskId: string): Promise<PreviewSession> {
    return this.tasksService.restartPreview(taskId);
  }

  @Sse(":taskId/stream")
  streamEvents(@Param("taskId") taskId: string): Observable<MessageEvent> {
    return this.tasksService.streamEvents(taskId);
  }
}
