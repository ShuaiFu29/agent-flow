import { Module } from "@nestjs/common";
import { TasksController } from "./tasks/tasks.controller";
import { InMemoryTasksRepository, TASKS_REPOSITORY } from "./tasks/tasks.repository";
import { TasksService } from "./tasks/tasks.service";

@Module({
  controllers: [TasksController],
  providers: [
    TasksService,
    {
      provide: TASKS_REPOSITORY,
      useClass: InMemoryTasksRepository,
    },
  ],
})
export class AppModule {}
