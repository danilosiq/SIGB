import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
