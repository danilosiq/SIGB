import { randomBytes } from "node:crypto";
import { db } from "./db";
import { digest, hashPassword, HttpError } from "./security";
import type { RegistrationInput } from "./validation";

export async function limitRegistrations(address: string) {
  const key = digest("registration:" + address);
  const now = new Date();
  const resetAt = new Date(Date.now() + 15 * 60_000);
  const [attempt] = await db.$queryRaw<{ attempts: number }[]>`
  INSERT INTO "LoginAttempt" (key,attempts,"resetAt") VALUES (${key},1,${resetAt})
  ON CONFLICT (key) DO UPDATE SET
   attempts=CASE WHEN "LoginAttempt"."resetAt" < ${now} THEN 1 ELSE "LoginAttempt".attempts+1 END,
   "resetAt"=CASE WHEN "LoginAttempt"."resetAt" < ${now} THEN ${resetAt} ELSE "LoginAttempt"."resetAt" END
  RETURNING attempts`;
  if (attempt.attempts > 10)
    throw new HttpError(
      429,
      "Muitos cadastros neste período. Aguarde 15 minutos.",
    );
}
export async function registerStudent(input: RegistrationInput) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const passwordHash = hashPassword(input.password);
  const user = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: "ALUNO",
      },
    });
    await tx.session.create({
      data: { id: digest(token), userId: user.id, expiresAt },
    });
    await tx.audit.create({
      data: {
        actorId: user.id,
        action: "ALUNO_CADASTRADO",
        entityId: user.id,
        details: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "ALUNO",
        },
      },
    });
    return user;
  });
  return { user, token, expiresAt };
}
