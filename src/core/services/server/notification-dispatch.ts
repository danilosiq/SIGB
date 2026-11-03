import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { notificationWorkflow } from "../../workflows/notifications";
import { db } from "./db";

// A failed queue handoff never rolls back a confirmed loan; the daily recovery
// finds the persisted outbox entry and dispatches it again.
export async function dispatchNotification(id: string, generation = "event") {
  try {
    await start(notificationWorkflow, [id], {
      hook: { token: `sigb:notification:${id}:${generation}` },
    });
  } catch (error) {
    if (HookConflictError.is(error)) return;
    await db.audit
      .create({
        data: {
          action: "NOTIFICACAO_FILA_PENDENTE",
          entityId: id,
          details: { reason: "workflow_unavailable" },
        },
      })
      .catch(() => console.error("SIGB notification queue audit unavailable"));
    console.error("SIGB notification queue unavailable", {
      notificationId: id,
    });
  }
}
export async function dispatchPending(generation: string) {
  const pending = await db.notification.findMany({
    where: {
      status: "PROCESSANDO",
      deliveries: { some: { status: "PROCESSANDO" } },
    },
    select: { id: true },
    take: 200,
  });
  for (const item of pending) await dispatchNotification(item.id, generation);
  return pending.length;
}
