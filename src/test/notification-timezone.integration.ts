/** Regression: PostgreSQL session time zone must not delay a UTC outbox item. */
import type { Delivery } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
async function main() {
  const value = process.env.SIGB_TEST_DATABASE_URL;
  assert.ok(value);
  const target = new URL(value);
  assert.equal(target.pathname, "/sigb_test");
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
  target.searchParams.set("connection_limit", "1");
  process.env.DATABASE_URL = target.toString();
  process.env.EMAIL_PROVIDER_URL = "https://notifications.invalid/test";
  process.env.EMAIL_PROVIDER_TOKEN = "test-only";
  const { db } = await import("../core/services/server/db");
  const { enqueueEvent, processNext } =
    await import("../core/services/server/notifications");
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: 503 });
  };
  const suffix = randomUUID();
  const user = await db.user.create({
    data: {
      name: "Timezone Test",
      email: `timezone-${suffix}@test.local`,
      passwordHash: "test",
    },
  });
  let notificationId: string | undefined;
  try {
    await db.$executeRawUnsafe("SET TIME ZONE 'America/Sao_Paulo'");
    const event = await enqueueEvent({
      eventKey: `timezone:${suffix}`,
      type: "TESTE",
      message: "Somente teste",
      recipientIds: [user.id],
      channels: ["EMAIL"],
    });
    notificationId = event.id;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1)
        await db.delivery.updateMany({
          where: { notificationId },
          data: { nextAttemptAt: new Date(0) },
        });
      assert.equal(
        await processNext(notificationId),
        true,
        "fresh delivery must be claimable regardless of session zone",
      );
      const delivery: Delivery = await db.delivery.findFirstOrThrow({
        where: { notificationId },
      });
      assert.equal(delivery.attempts, attempt);
      if (attempt < 3) {
        assert.equal(delivery.status, "PROCESSANDO");
        const interval = delivery.nextAttemptAt.getTime() - Date.now();
        assert.ok(interval > (attempt === 1 ? 59_000 : 119_000));
        assert.equal(
          await processNext(notificationId),
          false,
          "backoff must prevent an early retry",
        );
      } else assert.equal(delivery.status, "FALHA");
    }
    assert.equal(calls, 3);
    assert.equal(await processNext(notificationId), false);
    assert.equal(
      (
        await db.notification.findUniqueOrThrow({
          where: { id: notificationId },
        })
      ).status,
      "FALHA",
    );
    console.info(
      "Timezone outbox OK: immediate claim, 60/120s backoff, 3 attempts and final failure persisted.",
    );
  } finally {
    globalThis.fetch = original;
    if (notificationId) {
      await db.inboxNotification.deleteMany({ where: { notificationId } });
      await db.delivery.deleteMany({ where: { notificationId } });
      await db.notification.delete({ where: { id: notificationId } });
    }
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
