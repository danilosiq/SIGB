import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { databaseUrl } from "../src/core/services/server/database-env.mjs";

// Provisionamento explícito e exclusivo de produção. Nenhuma credencial é
// incorporada ao código ou disponibilizada por uma rota pública.
export async function bootstrapAdmin(db, input) {
  const { email, passwordHash, operationId } = input;
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof passwordHash !== "string" ||
    !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash) ||
    typeof operationId !== "string" ||
    !/^[a-f0-9-]{36}$/.test(operationId)
  ) {
    throw new Error(
      "Configuração inválida para provisionamento administrativo.",
    );
  }
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE`;
    // Uma publicação futura nunca deve redefinir novamente esta credencial.
    if (await tx.audit.findUnique({ where: { id: operationId } })) return false;
    const user = await tx.user.upsert({
      where: { email },
      create: { name: "Administrador", email, passwordHash, role: "ADMIN" },
      update: { passwordHash, role: "ADMIN", blocked: false, deletedAt: null },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.loginAttempt.deleteMany({
      where: { key: createHash("sha256").update(email).digest("hex") },
    });
    await tx.audit.create({
      data: {
        id: operationId,
        actorId: user.id,
        action: "ADMIN_INICIAL_CONFIGURADO",
        entityId: user.id,
        details: { email, role: "ADMIN" },
      },
    });
    return true;
  });
}

if (
  process.env.VERCEL_ENV === "production" &&
  process.env.SIGB_BOOTSTRAP_ADMIN
) {
  const db = new PrismaClient({ datasourceUrl: databaseUrl() });
  try {
    const created = await bootstrapAdmin(
      db,
      JSON.parse(process.env.SIGB_BOOTSTRAP_ADMIN),
    );
    console.info(
      created
        ? "Acesso administrativo provisionado."
        : "Provisionamento administrativo já concluído; credencial preservada.",
    );
  } catch {
    console.error("Falha no provisionamento administrativo.");
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
