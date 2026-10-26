import { Prisma, type Channel } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { retryDelay } from "../../utils/rules";
import { HttpError } from "./security";
type Event = {
  eventKey: string;
  type: string;
  message: string;
  channels: Channel[];
  recipientIds: string[];
};
export async function enqueue(tx: Prisma.TransactionClient, event: Event) {
  const existing = await tx.notification.findUnique({
    where: { eventKey: event.eventKey },
  });
  if (existing) return existing;
  const people = await tx.user.findMany({
    where: { id: { in: event.recipientIds }, deletedAt: null },
  });
  if (!people.length || people.length !== new Set(event.recipientIds).size)
    throw new HttpError(
      400,
      "O grupo contém destinatários inexistentes ou excluídos.",
    );
  const deliveries = people.flatMap((u) =>
    [...new Set(event.channels)].map((channel) => ({
      userId: u.id,
      channel,
      destination: (channel === "EMAIL" ? u.email : u.phone) ?? "",
    })),
  );
  const result = await tx.notification.create({
    data: {
      eventKey: event.eventKey,
      type: event.type,
      message: event.message,
      deliveries: { create: deliveries },
    },
  });
  await tx.audit.create({
    data: {
      action: "NOTIFICACAO_RECEBIDA",
      entityId: result.id,
      details: event,
    },
  });
  return result;
}
export async function enqueueEvent(event: Event) {
  try {
    return await db.$transaction((tx) => enqueue(tx, event));
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const existing = await db.notification.findUnique({
        where: { eventKey: event.eventKey },
      });
      if (existing) return existing;
    }
    throw e;
  }
}
async function settle(notificationId: string) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Notification" WHERE id = ${notificationId}::uuid FOR UPDATE`;
    const children = await tx.delivery.findMany({ where: { notificationId } });
    const status = children.some((d) => d.status === "PROCESSANDO")
      ? "PROCESSANDO"
      : children.every((d) => d.status === "ENVIADA")
        ? "ENVIADA"
        : "FALHA";
    await tx.notification.update({
      where: { id: notificationId },
      data: { status },
    });
  });
}
export async function processNext() {
  const now = new Date();
  const token = randomUUID();
  const delivery = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Delivery" WHERE status = 'PROCESSANDO' AND "nextAttemptAt" <= ${now} AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now}) ORDER BY "nextAttemptAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!rows[0]) return null;
    const previous = await tx.delivery.findUniqueOrThrow({
      where: { id: rows[0].id },
    });
    if (previous.attempts >= 3) {
      await tx.delivery.update({
        where: { id: previous.id },
        data: {
          status: "FALHA",
          lockedUntil: null,
          lastError: "Limite atingido após interrupção do worker.",
        },
      });
      await tx.audit.create({
        data: {
          action: "NOTIFICACAO_FALHA",
          entityId: previous.id,
          details: { reason: "lease_expired", attempts: previous.attempts },
        },
      });
      return { ...previous, exhausted: true };
    }
    const d = await tx.delivery.update({
      where: { id: previous.id },
      data: {
        attempts: { increment: 1 },
        lockedUntil: new Date(Date.now() + 60_000),
        leaseToken: token,
      },
      include: { notification: true },
    });
    await tx.audit.create({
      data: {
        action: "NOTIFICACAO_TENTATIVA",
        entityId: d.id,
        details: { attempt: d.attempts, channel: d.channel },
      },
    });
    return { ...d, exhausted: false };
  });
  if (!delivery) return false;
  if (delivery.exhausted) {
    await settle(delivery.notificationId);
    return true;
  }
  let failure: string | null = null;
  try {
    const url = process.env[delivery.channel + "_PROVIDER_URL"];
    const secret = process.env[delivery.channel + "_PROVIDER_TOKEN"];
    if (!url || !secret) throw new Error("Provedor do canal não configurado.");
    if (new URL(url).protocol !== "https:")
      throw new Error("O gateway deve usar HTTPS.");
    if (!delivery.destination)
      throw new Error("Destinatário sem contato para este canal.");
    const notification = await db.notification.findUniqueOrThrow({
      where: { id: delivery.notificationId },
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + secret,
        "Idempotency-Key": delivery.id,
      },
      body: JSON.stringify({
        to: delivery.destination,
        channel: delivery.channel,
        type: notification.type,
        message: notification.message,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error("Gateway retornou HTTP " + response.status);
  } catch (e) {
    failure = e instanceof Error ? e.message : "Falha de envio";
  }
  await db.$transaction(async (tx) => {
    const status = !failure
      ? "ENVIADA"
      : delivery.attempts >= 3
        ? "FALHA"
        : "PROCESSANDO";
    const result = await tx.delivery.updateMany({
      where: { id: delivery.id, leaseToken: token },
      data: {
        status,
        lastError: failure,
        lockedUntil: null,
        leaseToken: null,
        nextAttemptAt: new Date(Date.now() + retryDelay(delivery.attempts)),
      },
    });
    if (result.count)
      await tx.audit.create({
        data: {
          action: "NOTIFICACAO_" + status,
          entityId: delivery.id,
          details: { attempt: delivery.attempts, error: failure },
        },
      });
  });
  await settle(delivery.notificationId);
  return true;
}
