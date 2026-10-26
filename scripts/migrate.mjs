import { existsSync } from "node:fs";
import { migrationDatabaseUrl } from "../src/core/services/server/database-env.mjs";
import { spawnSync } from "node:child_process";
for (const file of [".env.local", ".env"])
  if (existsSync(file)) process.loadEnvFile(file);
const connection = migrationDatabaseUrl();
if (!connection) {
  console.error("Conexão PostgreSQL não configurada nas variáveis do projeto.");
  process.exit(1);
}
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: connection } },
);
process.exit(result.status ?? 1);
