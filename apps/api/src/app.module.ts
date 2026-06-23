import { Module } from "@nestjs/common";
import { CatalogController } from "./tasks/catalog.controller";
import { TasksController } from "./tasks/tasks.controller";
import { InMemoryTasksRepository, TASKS_REPOSITORY } from "./tasks/tasks.repository";
import { TasksService } from "./tasks/tasks.service";

@Module({
  controllers: [CatalogController, TasksController],
  providers: [
    TasksService,
    {
      provide: TASKS_REPOSITORY,
      useClass: InMemoryTasksRepository,
    },
  ],
})
export class AppModule {}
