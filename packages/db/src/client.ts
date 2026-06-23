import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  agentFlowPrisma?: PrismaClient;
};

export function createPrismaClient(): PrismaClient {
  globalForPrisma.agentFlowPrisma ??= new PrismaClient();

  return globalForPrisma.agentFlowPrisma;
}

export const prisma = createPrismaClient();
