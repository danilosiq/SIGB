import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./database-env.mjs";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDb.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl() });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
