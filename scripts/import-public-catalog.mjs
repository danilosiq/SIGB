import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";
import { databaseUrl } from "../src/core/services/server/database-env.mjs";

// Preview builds never import production catalogue data.
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.log("Public catalogue: skipped outside Vercel production.");
  process.exit(0);
}
const url = databaseUrl();
if (!url)
  throw new Error(
    "Configure a PostgreSQL connection before importing the public catalogue.",
  );
const directory = resolve(
  fileURLToPath(new URL("../prisma/catalog/", import.meta.url)),
);
const manifest = JSON.parse(
  await readFile(resolve(directory, "books.json"), "utf8"),
);
if (!Array.isArray(manifest.books) || manifest.books.length < 24)
  throw new Error("The reviewed catalogue must contain at least 24 books.");

// Validate every local asset before opening any database transaction.
const books = await Promise.all(
  manifest.books.map(async (entry) => {
    if (
      !/^gutenberg:\d+$/.test(entry.externalId) ||
      entry.isbn !== entry.externalId ||
      entry.format !== "DIGITAL"
    )
      throw new Error("Invalid catalogue identifier.");
    const reading = new URL(entry.readingUrl);
    if (
      reading.protocol !== "https:" ||
      reading.hostname !== "www.gutenberg.org"
    )
      throw new Error("Untrusted catalogue source.");
    const coverPath = resolve(directory, entry.cover);
    if (!coverPath.startsWith(directory + sep))
      throw new Error("Invalid cover path.");
    const data = await readFile(coverPath);
    if (
      data.length > 3_000_000 ||
      data[0] !== 255 ||
      data[1] !== 216 ||
      entry.mime !== "image/jpeg"
    )
      throw new Error("Invalid catalogue cover.");
    const { cover, coverSource, mime, ...book } = entry;
    void cover;
    void coverSource;
    return { book, mime, data };
  }),
);
const prisma = new PrismaClient({ datasourceUrl: url });
let imported = 0;
let preserved = 0;
try {
  for (const { book, mime, data } of books) {
    const created = await prisma
      .$transaction(
        async (tx) => {
          // Preserve editorial changes, availability, covers and soft-deletions on subsequent builds.
          const existing = await tx.book.findFirst({
            where: {
              OR: [{ externalId: book.externalId }, { isbn: book.isbn }],
            },
            select: { id: true },
          });
          if (existing) return false;
          const added = await tx.book.create({
            data: {
              ...book,
              available: true,
              cover: { create: { mime, data } },
            },
          });
          await tx.audit.create({
            data: {
              action: "BOOK_IMPORTED",
              entityId: added.id,
              details: {
                source: book.source,
                externalId: book.externalId,
                format: "DIGITAL",
              },
            },
          });
          return true;
        },
        { timeout: 15000 },
      )
      .catch((error) => {
        // Parallel production builds may race to insert the same unique source ID.
        if (error?.code === "P2002") return false;
        throw error;
      });
    if (created) imported++;
    else preserved++;
  }
  console.log(
    `Public catalogue: ${imported} digital books imported; ${preserved} existing records preserved.`,
  );
} finally {
  await prisma.$disconnect();
}
