import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { serverEnv } from "./env";

/**
 * One shared Prisma client for the whole server.
 *
 * Prisma 7 connects through a driver adapter rather than reading the URL from
 * the schema, so the connection string comes from the validated `serverEnv`
 * and a missing one fails on boot like every other key.
 *
 * Next's dev server re-evaluates modules on every hot reload. Without the
 * global cache below, each reload would construct a fresh client and open
 * another connection pool until the database refused new connections, so the
 * instance is stashed on `globalThis` outside production.
 */
const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: serverEnv.DATABASE_URL }),
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
