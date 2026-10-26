import { spawnSync } from "node:child_process";
import { databaseUrl } from "../src/core/services/server/database-env.mjs";
// Builds locais continuam disponíveis sem conexão externa.
// Na Vercel, use as credenciais injetadas pela integração do próprio projeto.
if (process.env.VERCEL === "1" && databaseUrl()) {
  for (const script of [
    "scripts/migrate.mjs",
    "scripts/check-database.mjs",
    "scripts/bootstrap-admin.mjs",
  ]) {
    const result = spawnSync(process.execPath, [script], {
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
