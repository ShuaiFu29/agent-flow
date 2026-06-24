import path from "node:path";
import { Inject, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { PrismaClient, createPrismaClient, ensureSqliteSchema } from "@agent-flow/db";
import { RunnerContextClient } from "./context/runner-context.client";
import { WorkspaceContextService } from "./context/workspace-context.service";
import { RunnerController } from "./runner/runner.controller";
import { RunnerService } from "./runner/runner.service";
import { ArtifactGenerator } from "./tasks/artifact-generator";
import { CatalogController } from "./tasks/catalog.controller";
import { PrismaTasksRepository } from "./tasks/prisma-tasks.repository";
import { TasksController } from "./tasks/tasks.controller";
import { TASKS_REPOSITORY } from "./tasks/tasks.repository";
import { TasksService } from "./tasks/tasks.service";

const PRISMA_CLIENT = "PRISMA_CLIENT";

@Injectable()
class PrismaClientLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

@Module({
  controllers: [CatalogController, RunnerController, TasksController],
  providers: [
    RunnerContextClient,
    RunnerService,
    ArtifactGenerator,
    TasksService,
    WorkspaceContextService,
    {
      provide: PRISMA_CLIENT,
      useFactory: () => {
        const databaseUrl = resolveDatabaseUrl();
        ensureSqliteSchema(databaseUrl);
        return createPrismaClient({
          databaseUrl,
          useSingleton: false,
        });
      },
    },
    {
      provide: TASKS_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaTasksRepository(prisma),
      inject: [PRISMA_CLIENT],
    },
    PrismaClientLifecycle,
  ],
})
export class AppModule {}

function resolveDatabaseUrl(): string {
  const configuredDatabaseUrl = process.env.DATABASE_URL;
  if (configuredDatabaseUrl) {
    return configuredDatabaseUrl;
  }

  const defaultDatabasePath = path.resolve(process.cwd(), ".agent-flow", "state", "api.sqlite");
  return `file:${defaultDatabasePath.replaceAll("\\", "/")}`;
}
