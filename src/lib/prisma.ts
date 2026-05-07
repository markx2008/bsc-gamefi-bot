import { PrismaClient } from '@prisma/client';
import { ensureDatabaseUrl } from './databaseUrl';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma() {
  ensureDatabaseUrl();

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}
