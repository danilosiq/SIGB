import { type Prisma } from "@prisma/client";
import { db } from "./db";
import { defaultDueAt, fineAt, shouldBlock } from "../../utils/rules";
import { HttpError } from "./security";
import { enqueue } from "./notifications";
export async function refreshUser(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const loans = await tx.loan.findMany({ where: { userId, returnedAt: null } });
  for (const loan of loans) {
    const fine = fineAt(loan.dueAt);
    if (fine !== loan.fineCents) {
      await tx.loan.update({
        where: { id: loan.id },
        data: { fineCents: fine },
      });
      await tx.audit.create({
        data: {
          action: "MULTA_ATUALIZADA",
          entityId: loan.id,
          details: { fineCents: fine },
        },
      });
    }
    if (shouldBlock(loan.borrowedAt)) {
      const changed = await tx.user.updateMany({
        where: { id: userId, blocked: false },
        data: { blocked: true },
      });
      if (changed.count) {
        await tx.audit.create({
          data: {
            action: "USUARIO_BLOQUEADO",
            entityId: userId,
            details: { loanId: loan.id },
          },
        });
        const staff = await tx.user.findMany({
          where: { role: "BIBLIOTECARIO", deletedAt: null },
        });
        if (staff.length)
          await enqueue(tx, {
            eventKey: "block:" + loan.id,
            type: "BLOQUEIO_POR_ATRASO",
            message:
              "Aluno bloqueado por empréstimo pendente há mais de dois meses. Consulte os empréstimos.",
            channels: ["EMAIL"],
            recipientIds: staff.map((u) => u.id),
          });
      }
    }
  }
}
export async function borrow(userId: string, bookId: string) {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    await refreshUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.deletedAt || user.role !== "ALUNO")
      throw new HttpError(403, "Cadastro sem permissão para empréstimo.");
    if (user.blocked) return null;
    const available = await tx.book.updateMany({
      where: { id: bookId, available: true, deletedAt: null },
      data: { available: false },
    });
    if (!available.count) throw new HttpError(409, "Livro indisponível");
    const loan = await tx.loan.create({
      data: { userId, bookId, dueAt: defaultDueAt() },
    });
    await tx.audit.create({
      data: {
        actorId: userId,
        action: "EMPRESTIMO_CRIADO",
        entityId: loan.id,
        details: {
          ...loan,
          borrowedAt: loan.borrowedAt.toISOString(),
          dueAt: loan.dueAt.toISOString(),
        },
      },
    });
    return loan;
  });
  if (!result)
    throw new HttpError(
      403,
      "Conta bloqueada por atraso. Procure a biblioteca.",
    );
  return result;
}
export async function changeLoan(
  actor: { id: string; role: string },
  id: string,
  action: string,
  date?: Date,
) {
  return db.$transaction(async (tx) => {
    const snapshot = await tx.loan.findUnique({ where: { id } });
    if (!snapshot) throw new HttpError(404, "Empréstimo não encontrado.");
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${snapshot.userId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${id}::uuid FOR UPDATE`;
    const loan = await tx.loan.findUnique({ where: { id } });
    if (!loan) throw new HttpError(404, "Empréstimo não encontrado.");
    if (loan.returnedAt) throw new HttpError(409, "Empréstimo já devolvido.");
    const staff = actor.role === "ADMIN" || actor.role === "BIBLIOTECARIO";
    if (!staff && loan.userId !== actor.id)
      throw new HttpError(403, "Acesso negado.");
    if (["return", "schedule", "confirm"].includes(action) && !staff)
      throw new HttpError(
        403,
        "A devolução deve ser confirmada pela biblioteca.",
      );
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${loan.userId}::uuid FOR UPDATE`;
    await refreshUser(tx, loan.userId);
    let data: Prisma.LoanUpdateInput;
    if (action === "return") {
      if (!loan.pickupConfirmedAt)
        throw new HttpError(409, "Confirme a retirada antes da devolução.");
      data = { returnedAt: new Date(), fineCents: fineAt(loan.dueAt) };
      await tx.book.update({
        where: { id: loan.bookId },
        data: { available: true },
      });
    } else if (action === "renew") {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: loan.userId },
      });
      if (!loan.pickupConfirmedAt)
        throw new HttpError(
          409,
          "Aguarde a confirmação da retirada pela biblioteca.",
        );
      if (user.blocked || fineAt(loan.dueAt) > 0 || loan.renewals >= 1)
        throw new HttpError(
          409,
          "Renovação indisponível: atraso, bloqueio ou limite de uma renovação.",
        );
      data = { dueAt: defaultDueAt(loan.dueAt), renewals: { increment: 1 } };
    } else if (action === "confirm" && staff) {
      if (loan.pickupConfirmedAt)
        throw new HttpError(409, "Retirada já confirmada.");
      data = { pickupConfirmedAt: new Date() };
    } else if (action === "schedule" && staff && date) {
      if (loan.pickupConfirmedAt)
        throw new HttpError(409, "A retirada deste livro já foi confirmada.");
      if (date < new Date() || date > loan.dueAt)
        throw new HttpError(
          400,
          "Agende uma retirada futura anterior ao prazo de devolução.",
        );
      data = { pickupAt: date };
    } else if (action === "deadline" && staff && date) {
      if (date <= new Date() || date > new Date(Date.now() + 90 * 86400000))
        throw new HttpError(400, "Prazo deve estar entre amanhã e 90 dias.");
      data = { dueAt: date };
    } else throw new HttpError(400, "Operação inválida.");
    const result = await tx.loan.update({ where: { id }, data });
    await tx.audit.create({
      data: {
        actorId: actor.id,
        action: "EMPRESTIMO_" + action.toUpperCase(),
        entityId: id,
        details: JSON.parse(JSON.stringify({ before: loan, after: result })),
      },
    });
    return result;
  });
}
export async function scheduledMaintenance() {
  const users = await db.user.findMany({
    where: { loans: { some: { returnedAt: null } } },
    select: { id: true },
  });
  for (const user of users)
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
      await refreshUser(tx, user.id);
    });
  const due = await db.loan.findMany({
    where: {
      returnedAt: null,
      dueAt: { gte: new Date(), lte: new Date(Date.now() + 3 * 86400000) },
    },
    include: { book: true },
  });
  for (const loan of due)
    await db.$transaction((tx) =>
      enqueue(tx, {
        eventKey: "due:" + loan.id + ":" + loan.dueAt.toISOString(),
        type: "PRAZO_PROXIMO",
        message: `O prazo de devolução de “${loan.book.title}” termina em ${loan.dueAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        channels: ["EMAIL"],
        recipientIds: [loan.userId],
      }),
    );
}
