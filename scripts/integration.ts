/** Executar somente em PostgreSQL descartável, usando SIGB_TEST_DATABASE_URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
async function main() {
  const url = process.env.SIGB_TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("/sigb_test"))
    throw new Error(
      "Informe SIGB_TEST_DATABASE_URL apontando para o banco descartável sigb_test.",
    );
  process.env.DATABASE_URL = url;
  const { db } = await import("../src/core/services/server/db");
  const { borrow, changeLoan, scheduledMaintenance } =
    await import("../src/core/services/server/loans");
  const { enqueueEvent, processNext } =
    await import("../src/core/services/server/notifications");
  const suffix = randomUUID();
  try {
    const student = await db.user.create({
      data: {
        name: "Aluno A",
        email: "a-" + suffix + "@test.local",
        passwordHash: "test",
        phone: "+5511999999999",
      },
    });
    const other = await db.user.create({
      data: {
        name: "Aluno B",
        email: "b-" + suffix + "@test.local",
        passwordHash: "test",
      },
    });
    const librarian = await db.user.create({
      data: {
        name: "Bibliotecário",
        email: "staff-" + suffix + "@test.local",
        passwordHash: "test",
        role: "BIBLIOTECARIO",
      },
    });
    const book = await db.book.create({
      data: {
        title: "Concorrência",
        author: "Teste",
        isbn: suffix,
        category: "Ciência",
        description: "Teste de integridade",
        publisher: "SIGB",
        year: 2026,
        pages: 100,
      },
    });
    const race = await Promise.allSettled([
      borrow(student.id, book.id),
      borrow(other.id, book.id),
    ]);
    assert.equal(
      race.filter((r) => r.status === "fulfilled").length,
      1,
      "Um exemplar só pode ser emprestado uma vez",
    );
    assert.equal(
      await db.loan.count({ where: { bookId: book.id, returnedAt: null } }),
      1,
    );
    assert.equal(
      (await db.book.findUniqueOrThrow({ where: { id: book.id } })).available,
      false,
    );
    const loan = await db.loan.findFirstOrThrow({
      where: { bookId: book.id, returnedAt: null },
    });
    const owner = loan.userId === student.id ? student : other;
    const stranger = loan.userId === student.id ? other : student;
    await assert.rejects(
      () => changeLoan({ id: stranger.id, role: "ALUNO" }, loan.id, "renew"),
      /Acesso negado/,
    );
    await assert.rejects(
      () => changeLoan({ id: owner.id, role: "ALUNO" }, loan.id, "return"),
      /biblioteca/,
    );
    await assert.rejects(
      () => changeLoan({ id: owner.id, role: "ALUNO" }, loan.id, "confirm"),
      /biblioteca/,
    );
    await changeLoan(
      { id: librarian.id, role: "BIBLIOTECARIO" },
      loan.id,
      "schedule",
      new Date(Date.now() + 86400000),
    );
    await changeLoan(
      { id: librarian.id, role: "BIBLIOTECARIO" },
      loan.id,
      "confirm",
    );
    await changeLoan({ id: owner.id, role: "ALUNO" }, loan.id, "renew");
    await assert.rejects(
      () => changeLoan({ id: owner.id, role: "ALUNO" }, loan.id, "renew"),
      /Renovação indisponível/,
    );
    await db.loan.update({
      where: { id: loan.id },
      data: { dueAt: new Date(Date.now() - 3 * 86400000) },
    });
    const returned = await changeLoan(
      { id: librarian.id, role: "BIBLIOTECARIO" },
      loan.id,
      "return",
    );
    assert.equal(returned.fineCents, 300);
    assert.ok(returned.returnedAt);
    assert.equal(
      (await db.book.findUniqueOrThrow({ where: { id: book.id } })).available,
      true,
    );
    const second = await borrow(owner.id, book.id);
    await db.loan.update({
      where: { id: second.id },
      data: {
        borrowedAt: new Date("2026-01-01"),
        dueAt: new Date("2026-01-15"),
      },
    });
    await assert.rejects(() => borrow(owner.id, book.id), /bloqueada/);
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).blocked,
      true,
      "Bloqueio precisa persistir mesmo quando empréstimo é negado",
    );
    assert.ok(
      await db.notification.count({ where: { type: "BLOQUEIO_POR_ATRASO" } }),
    );
    await scheduledMaintenance();
    const input = {
      eventKey: "integration:" + suffix,
      type: "TESTE",
      message: "Teste de multicanalidade",
      channels: ["EMAIL", "SMS", "WHATSAPP"] as const,
      recipientIds: [student.id],
    };
    const event = await enqueueEvent({
      ...input,
      channels: [...input.channels],
    });
    assert.equal(
      (await enqueueEvent({ ...input, channels: [...input.channels] })).id,
      event.id,
    );
    assert.equal(
      await db.delivery.count({ where: { notificationId: event.id } }),
      3,
    );
    // Sem provedores, falhas devem ser persistidas e encerradas em três tentativas.
    const pendingCount = await db.delivery.count({
      where: { status: "PROCESSANDO" },
    });
    for (let i = 0; i < pendingCount * 3 + 5; i++) {
      await db.delivery.updateMany({
        where: { status: "PROCESSANDO" },
        data: { nextAttemptAt: new Date(0) },
      });
      if (!(await processNext())) break;
    }
    const failed = await db.notification.findUniqueOrThrow({
      where: { id: event.id },
      include: { deliveries: true },
    });
    assert.equal(failed.status, "FALHA");
    assert.ok(
      failed.deliveries.every((d) => d.attempts === 3 && d.status === "FALHA"),
    );
    const deliveries = failed.deliveries.map((d) => d.id);
    assert.equal(
      await db.audit.count({
        where: {
          entityId: { in: deliveries },
          action: "NOTIFICACAO_TENTATIVA",
        },
      }),
      9,
    );
    // Gateway simulado com idempotência. Nenhuma mensagem real é enviada.
    const previousFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
      calls++;
      assert.ok((init?.headers as Record<string, string>)["Idempotency-Key"]);
      return new Response("{}", { status: 200 });
    };
    process.env.EMAIL_PROVIDER_URL = "https://gateway.test/email";
    process.env.EMAIL_PROVIDER_TOKEN = "test";
    const sent = await enqueueEvent({
      eventKey: "success:" + suffix,
      type: "TESTE",
      message: "Sucesso",
      channels: ["EMAIL"],
      recipientIds: [student.id],
    });
    await db.delivery.updateMany({
      where: { notificationId: sent.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await Promise.all([processNext(), processNext()]);
    globalThis.fetch = previousFetch;
    assert.equal(
      calls,
      1,
      "Dois workers não podem enviar o mesmo item simultaneamente",
    );
    assert.equal(
      (await db.notification.findUniqueOrThrow({ where: { id: sent.id } }))
        .status,
      "ENVIADA",
    );
    const audit = await db.audit.findFirstOrThrow();
    await assert.rejects(
      () =>
        db.audit.update({
          where: { id: audit.id },
          data: { action: "TAMPER" },
        }),
      /immutable/,
    );
    console.info(
      "Integração OK: concorrência, autorização, renovação, multa, bloqueio persistente, multicanalidade, retentativas, idempotência e auditoria imutável.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
