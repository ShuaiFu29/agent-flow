import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  agentFlowPrisma?: PrismaClient;
};

export type PrismaClientConfig = {
  databaseUrl?: string;
  useSingleton?: boolean;
};

export function createPrismaClient(config: PrismaClientConfig = {}): PrismaClient {
  const useSingleton = config.useSingleton ?? !config.databaseUrl;
  const options = config.databaseUrl
    ? {
        datasources: {
          db: {
            url: ensureSqliteDirectory(config.databaseUrl),
          },
        },
      }
    : undefined;

  if (!useSingleton) {
    return new PrismaClient(options);
  }

  globalForPrisma.agentFlowPrisma ??= new PrismaClient(options);

  return globalForPrisma.agentFlowPrisma;
}

export const prisma = createPrismaClient();

function ensureSqliteDirectory(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const databasePath = databaseUrl.slice("file:".length);
  if (!databasePath || databasePath === ":memory:") {
    return databaseUrl;
  }

  const normalizedPath = databasePath.replace(/\//g, path.sep);
  const directory = path.dirname(normalizedPath);
  fs.mkdirSync(directory, { recursive: true });

  return databaseUrl;
}
