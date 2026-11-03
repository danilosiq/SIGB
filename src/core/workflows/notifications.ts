import { sleep } from "workflow";

async function deliverBatch(notificationId: string) {
  "use step";
  const { processNext } = await import("../services/server/notifications");
  const { db } = await import("../services/server/db");
  console.info("SIGB notification batch", { notificationId });
  for (let i = 0; i < 10; i++) if (!(await processNext(notificationId))) break;
  const pending = await db.delivery.findMany({
    where: { notificationId, status: "PROCESSANDO" },
    select: { nextAttemptAt: true, lockedUntil: true },
  });
  if (!pending.length) return null;
  return Math.max(
    Date.now() + 1_000,
    Math.min(
      ...pending.map((d) =>
        Math.max(d.nextAttemptAt.getTime(), d.lockedUntil?.getTime() ?? 0),
      ),
    ),
  );
}

export async function notificationWorkflow(notificationId: string) {
  "use workflow";
  while (true) {
    const next = await deliverBatch(notificationId);
    if (next === null) return;
    await sleep(new Date(next));
  }
}
