import { processNext } from "../src/core/services/server/notifications";
import { scheduledMaintenance } from "../src/core/services/server/loans";
import { db } from "../src/core/services/server/db";
let running = true;
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});
let lastMaintenance = 0;
async function main() {
  while (running) {
    try {
      if (Date.now() - lastMaintenance > 60_000) {
        await scheduledMaintenance();
        lastMaintenance = Date.now();
      }
      if (!(await processNext())) await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.error(
        "Worker:",
        e instanceof Error ? e.message : "Falha temporária",
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await db.$disconnect();
}
main().catch(() => {
  process.exitCode = 1;
});
