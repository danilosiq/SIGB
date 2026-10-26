import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { demoBooks } from "../src/core/features/library/data/demo";
import { hashPassword } from "../src/core/services/server/security";
const db = new PrismaClient();
async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 10)
    throw new Error("Defina SEED_ADMIN_PASSWORD com pelo menos 10 caracteres.");
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@sigb.local";
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      name: "Administrador SIGB",
      email,
      role: "ADMIN",
      passwordHash: hashPassword(password),
    },
  });
  for (const { id, coverUrl, ...book } of demoBooks) {
    void id;
    const stored = await db.book.upsert({
      where: { isbn: book.isbn },
      update: {},
      create: { ...book, available: true },
    });
    if (coverUrl) {
      const data = await readFile("public" + coverUrl);
      await db.cover.upsert({
        where: { bookId: stored.id },
        update: {},
        create: { bookId: stored.id, mime: "image/svg+xml", data },
      });
    }
  }
  console.info("Administrador e acervo inicial preparados.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
