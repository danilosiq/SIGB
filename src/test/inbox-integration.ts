/** Service integration: run only with SIGB_TEST_DATABASE_URL targeting local sigb_test. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const url = process.env.SIGB_TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "Set SIGB_TEST_DATABASE_URL for the disposable sigb_test database.",
    );
  const target = new URL(url);
  if (
    target.pathname !== "/sigb_test" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
  )
    throw new Error("This test only accepts a local database named sigb_test.");
  process.env.DATABASE_URL = url;
  const { db } = await import("../core/services/server/db");
  const { borrow } = await import("../core/services/server/loans");
  const { enqueueEvent } =
    await import("../core/services/server/notifications");
  const { HttpError } = await import("../core/services/server/security");
  const prefix = `inbox-test:${randomUUID()}:`;
  const triggerName = `inbox_test_${randomUUID().replaceAll("-", "")}`;
  const userIds: string[] = [];
  const bookIds: string[] = [];
  let triggerCreated = false;
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    providerCalls++;
    throw new Error(
      "External requests are forbidden in inbox integration tests.",
    );
  };
  try {
    const database = await db.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;
    assert.equal(database[0]?.name, "sigb_test");
    async function user(label: string) {
      const row = await db.user.create({
        data: {
          name: `Inbox test ${label}`,
          email: `${label}-${randomUUID()}@test.invalid`,
          passwordHash: "non-login-test-value",
          phone: "+5511999999999",
        },
      });
      userIds.push(row.id);
      return row;
    }
    async function book(label: string, format = "PHYSICAL") {
      const row = await db.book.create({
        data: {
          title: `${prefix}${label}`,
          author: "Integration test",
          isbn: randomUUID(),
          category: "Ciência",
          description: "Disposable integration fixture",
          publisher: "SIGB test",
          year: 2026,
          pages: 10,
          format,
          readingUrl:
            format === "DIGITAL" ? "https://example.org/test-book" : null,
        },
      });
      bookIds.push(row.id);
      return row;
    }
    const alice = await user("alice");
    const bob = await user("bob");
    const outsider = await user("outsider");
    const faultRecipient = await user("fault");
    const physical = await book("physical");
    const digital = await book("digital", "DIGITAL");
    const faultBook = await book("fault");

    const loan = await borrow(alice.id, physical.id);
    const notification = await db.notification.findUniqueOrThrow({
      where: { eventKey: `borrow:${loan.id}` },
      include: { deliveries: true, inbox: true },
    });
    assert.equal(notification.type, "EMPRESTIMO_CONFIRMADO");
    assert.equal(notification.status, "PROCESSANDO");
    assert.equal(notification.inbox.length, 1);
    assert.equal(notification.inbox[0].userId, alice.id);
    assert.equal(notification.inbox[0].readAt, null);
    assert.equal(notification.deliveries.length, 1);
    assert.equal(notification.deliveries[0].channel, "EMAIL");
    assert.equal(notification.deliveries[0].attempts, 0);
    assert.equal(
      (await db.book.findUniqueOrThrow({ where: { id: physical.id } }))
        .available,
      false,
    );
    assert.equal(
      await db.audit.count({
        where: { entityId: loan.id, action: "EMPRESTIMO_CRIADO" },
      }),
      1,
    );
    assert.equal(
      await db.audit.count({
        where: { entityId: notification.id, action: "NOTIFICACAO_RECEBIDA" },
      }),
      1,
    );
    console.log(
      "PASS borrow persists loan, availability, notification, inbox, delivery and audits",
    );

    await assert.rejects(
      () => borrow(alice.id, digital.id),
      (error: unknown) => error instanceof HttpError && error.status === 409,
    );
    assert.equal(await db.loan.count({ where: { bookId: digital.id } }), 0);
    assert.equal(
      (await db.book.findUniqueOrThrow({ where: { id: digital.id } }))
        .available,
      true,
    );
    assert.equal(
      await db.inboxNotification.count({ where: { userId: alice.id } }),
      1,
    );
    console.log(
      "PASS digital borrowing returns 409 without loan or inbox side effects",
    );

    const event = {
      eventKey: `${prefix}shared`,
      type: "PRAZO_PROXIMO",
      message: "Disposable shared reminder",
      channels: ["EMAIL", "SMS", "EMAIL"] as ("EMAIL" | "SMS")[],
      recipientIds: [alice.id, bob.id, alice.id],
    };
    const first = await enqueueEvent(event);
    const repeated = await enqueueEvent(event);
    assert.equal(first.id, repeated.id);
    const raceEvent = { ...event, eventKey: `${prefix}race` };
    const race = await Promise.all(
      Array.from({ length: 6 }, () => enqueueEvent(raceEvent)),
    );
    assert.equal(new Set(race.map((n) => n.id)).size, 1);
    for (const eventKey of [event.eventKey, raceEvent.eventKey]) {
      const found = await db.notification.findUniqueOrThrow({
        where: { eventKey },
        include: { inbox: true, deliveries: true },
      });
      assert.equal(found.inbox.length, 2);
      assert.equal(found.deliveries.length, 4);
      assert.equal(
        await db.audit.count({
          where: { entityId: found.id, action: "NOTIFICACAO_RECEBIDA" },
        }),
        1,
      );
    }
    console.log(
      "PASS sequential and concurrent event receipt is idempotent; channels and recipients deduplicated",
    );

    // These are the user-scoped DB predicates used by the inbox endpoints.
    const readAt = new Date("2026-11-03T20:00:00.000Z");
    const marked = await db.inboxNotification.updateMany({
      where: { userId: alice.id, notificationId: first.id },
      data: { readAt },
    });
    assert.equal(marked.count, 1);
    assert.equal(
      (
        await db.inboxNotification.findUniqueOrThrow({
          where: {
            notificationId_userId: {
              notificationId: first.id,
              userId: alice.id,
            },
          },
        })
      ).readAt?.toISOString(),
      readAt.toISOString(),
    );
    assert.equal(
      (
        await db.inboxNotification.findUniqueOrThrow({
          where: {
            notificationId_userId: { notificationId: first.id, userId: bob.id },
          },
        })
      ).readAt,
      null,
    );
    assert.equal(
      (await db.notification.findUniqueOrThrow({ where: { id: first.id } }))
        .status,
      "PROCESSANDO",
    );
    assert.equal(
      await db.delivery.count({
        where: { notificationId: first.id, status: "PROCESSANDO", attempts: 0 },
      }),
      4,
    );
    const strangerRead = await db.inboxNotification.updateMany({
      where: { userId: outsider.id, notificationId: first.id },
      data: { readAt },
    });
    assert.equal(strangerRead.count, 0);
    assert.equal(
      await db.inboxNotification.count({ where: { userId: outsider.id } }),
      0,
    );
    const allRead = await db.inboxNotification.updateMany({
      where: { userId: alice.id, readAt: null },
      data: { readAt },
    });
    assert.equal(allRead.count, 2);
    assert.equal(
      await db.inboxNotification.count({
        where: { userId: alice.id, readAt: null },
      }),
      0,
    );
    assert.equal(
      await db.inboxNotification.count({
        where: { userId: bob.id, readAt: null },
      }),
      2,
    );
    const bobInbox = await db.inboxNotification.findMany({
      where: { userId: bob.id },
      include: {
        notification: {
          include: {
            deliveries: {
              where: { userId: bob.id },
              select: { userId: true, destination: true },
            },
          },
        },
      },
    });
    assert.equal(bobInbox.length, 2);
    assert.ok(
      bobInbox.every((n) =>
        n.notification.deliveries.every(
          (d) =>
            d.userId === bob.id &&
            [bob.email, bob.phone].includes(d.destination),
        ),
      ),
    );
    assert.ok(bobInbox.every((n) => n.notificationId !== notification.id));
    console.log(
      "PASS per-user receipts and mark-all stay isolated, without changing delivery status or exposing other recipients",
    );

    const invalidKey = `${prefix}invalid-recipient`;
    await assert.rejects(
      () =>
        enqueueEvent({
          ...event,
          eventKey: invalidKey,
          recipientIds: [alice.id, randomUUID()],
        }),
      (error: unknown) => error instanceof HttpError && error.status === 400,
    );
    assert.equal(
      await db.notification.count({ where: { eventKey: invalidKey } }),
      0,
    );
    console.log(
      "PASS invalid recipient event rolls back without partial notification",
    );

    // Inject a recipient-specific DB failure after borrow has created its loan and notification.
    // Identifiers and the conditional UUID are generated by this process, never user input.
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${triggerName}"() RETURNS trigger AS $$ BEGIN IF NEW."userId" = '${faultRecipient.id}'::uuid THEN RAISE EXCEPTION 'inbox-test-injected-failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
    );
    triggerCreated = true;
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "InboxNotification" FOR EACH ROW EXECUTE FUNCTION "${triggerName}"()`,
    );
    await assert.rejects(
      () => borrow(faultRecipient.id, faultBook.id),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("inbox-test-injected-failure"),
    );
    assert.equal(
      await db.loan.count({ where: { userId: faultRecipient.id } }),
      0,
    );
    assert.equal(
      (await db.book.findUniqueOrThrow({ where: { id: faultBook.id } }))
        .available,
      true,
    );
    assert.equal(
      await db.notification.count({
        where: { message: { contains: faultBook.title } },
      }),
      0,
    );
    assert.equal(
      await db.delivery.count({ where: { userId: faultRecipient.id } }),
      0,
    );
    assert.equal(
      await db.inboxNotification.count({
        where: { userId: faultRecipient.id },
      }),
      0,
    );
    assert.equal(
      await db.audit.count({
        where: { actorId: faultRecipient.id, action: "EMPRESTIMO_CRIADO" },
      }),
      0,
    );
    assert.equal(providerCalls, 0);
    console.log(
      "PASS inbox failure rolls back the entire borrow transaction; no external provider was called",
    );
  } finally {
    if (triggerCreated) {
      await db.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "InboxNotification"`,
      );
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerName}"()`);
    }
    const notifications = await db.notification.findMany({
      where: {
        OR: [
          { eventKey: { startsWith: prefix } },
          { inbox: { some: { userId: { in: userIds } } } },
        ],
      },
      select: { id: true },
    });
    const notificationIds = notifications.map((n) => n.id);
    await db.delivery.deleteMany({
      where: { notificationId: { in: notificationIds } },
    });
    await db.inboxNotification.deleteMany({
      where: { notificationId: { in: notificationIds } },
    });
    await db.notification.deleteMany({
      where: { id: { in: notificationIds } },
    });
    await db.loan.deleteMany({ where: { userId: { in: userIds } } });
    await db.book.deleteMany({ where: { id: { in: bookIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    // Audit remains append-only; all other disposable fixtures and fault injection are removed.
    globalThis.fetch = originalFetch;
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
