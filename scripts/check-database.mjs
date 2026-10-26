import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "../src/core/services/server/database-env.mjs";
for (const file of [".env.local", ".env"])
  if (existsSync(file)) process.loadEnvFile(file);
const url = databaseUrl();
if (!url) {
  console.error("Nenhuma conexão PostgreSQL disponível neste ambiente.");
  process.exit(1);
}
const db = new PrismaClient({ datasourceUrl: url });
try {
  await db.$queryRaw`SELECT 1`;
  console.info("Conexão PostgreSQL confirmada.");
} catch (error) {
  console.error(
    "Não foi possível conectar ao PostgreSQL.",
    error?.code ?? "Verifique acesso e variáveis de ambiente.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
