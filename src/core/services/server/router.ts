import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z, ZodError } from "zod";
import { db } from "./db";
import {
  HttpError,
  currentUser,
  requireUser,
  checkOrigin,
  webhookAuth,
  hashPassword,
  checkPassword,
  digest,
  publicUser,
} from "./security";
import {
  bookSchema,
  userSchema,
  profileSchema,
  uuid,
  notificationSchema,
} from "./validation";
import { borrow, changeLoan } from "./loans";
import { enqueueEvent } from "./notifications";
import { fineAt } from "../../utils/rules";
const staff = ["ADMIN", "BIBLIOTECARIO"] as const;
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function handle(req: Request, segments: string[]) {
  try {
    const [resource, id, sub] = segments;
    const method = req.method;
    if (method !== "GET" && method !== "HEAD" && resource !== "webhooks")
      checkOrigin(req);
    if (resource === "config" && method === "GET")
      return json({
        demo: !process.env.DATABASE_URL,
        policy: {
          loanDays: Number(process.env.LOAN_DAYS) || 14,
          dailyFineCents: Number(process.env.DAILY_FINE_CENTS) || 100,
        },
      });
    if (!process.env.DATABASE_URL)
      throw new HttpError(
        503,
        "Conecte o Neon em DATABASE_URL para usar os dados reais.",
      );
    if (resource === "auth") {
      if (id === "me" && method === "GET") {
        const u = await currentUser();
        return json(u ? publicUser(u) : null);
      }
      if (id === "logout" && method === "POST") {
        const c = await cookies();
        const token = c.get("sigb-session")?.value;
        if (token)
          await db.session.deleteMany({ where: { id: digest(token) } });
        c.delete("sigb-session");
        return json({ ok: true });
      }
      if (id === "login" && method === "POST") {
        const { email, password } = z
          .object({
            email: z.email().transform((v) => v.toLowerCase()),
            password: z.string().min(1).max(128),
          })
          .parse(await req.json());
        const key = digest(email);
        const attempt = await db.loginAttempt.upsert({
          where: { key },
          create: {
            key,
            attempts: 1,
            resetAt: new Date(Date.now() + 15 * 60_000),
          },
          update: { attempts: { increment: 1 } },
        });
        if (attempt.resetAt < new Date())
          await db.loginAttempt.update({
            where: { key },
            data: { attempts: 1, resetAt: new Date(Date.now() + 15 * 60_000) },
          });
        else if (attempt.attempts > 10)
          throw new HttpError(429, "Muitas tentativas. Aguarde 15 minutos.");
        const u = await db.user.findUnique({ where: { email } });
        if (!u || u.deletedAt || !checkPassword(password, u.passwordHash))
          throw new HttpError(401, "E-mail ou senha incorretos.");
        await db.loginAttempt.deleteMany({ where: { key } });
        const token = randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 7 * 86400000);
        await db.session.create({
          data: { id: digest(token), userId: u.id, expiresAt: expires },
        });
        (await cookies()).set("sigb-session", token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          expires,
        });
        return json(publicUser(u));
      }
    }
    if (resource === "webhooks" && id === "notificacoes" && method === "POST") {
      webhookAuth(req);
      const event = notificationSchema.parse(await req.json());
      const n = await enqueueEvent(event);
      return json({ id_notificacao: n.id, status: n.status }, 202);
    }
    const actor = await requireUser();
    if (resource === "profile" && method === "PATCH") {
      const input = profileSchema.parse(await req.json());
      const u = await db.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: actor.id },
          data: input,
        });
        await tx.audit.create({
          data: {
            actorId: actor.id,
            action: "PERFIL_EDITADO",
            entityId: actor.id,
            details: input,
          },
        });
        return u;
      });
      return json(publicUser(u));
    }
    if (resource === "books") {
      if (id) uuid.parse(id);
      if (sub === "cover" && method === "GET") {
        const cover = await db.cover.findUnique({ where: { bookId: id } });
        if (!cover) throw new HttpError(404, "Capa não encontrada.");
        return new Response(new Uint8Array(cover.data), {
          headers: {
            "Content-Type": cover.mime,
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (sub === "cover" && method === "POST") {
        await requireUser([...staff]);
        const file = (await req.formData()).get("file");
        if (!(file instanceof File) || file.size > 3 * 1024 * 1024)
          throw new HttpError(
            400,
            "Selecione uma imagem PNG, JPEG ou WebP de até 3 MB.",
          );
        const data = Buffer.from(await file.arrayBuffer());
        const mime = data
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : data[0] === 255 && data[1] === 216 && data[2] === 255
            ? "image/jpeg"
            : data.subarray(0, 4).toString() === "RIFF" &&
                data.subarray(8, 12).toString() === "WEBP"
              ? "image/webp"
              : null;
        if (!mime) throw new HttpError(400, "Formato de imagem inválido.");
        await db.$transaction(async (tx) => {
          await tx.cover.upsert({
            where: { bookId: id },
            create: { bookId: id, mime, data },
            update: { mime, data },
          });
          await tx.audit.create({
            data: {
              actorId: actor.id,
              action: "CAPA_ARMAZENADA",
              entityId: id,
              details: { mime, size: data.length },
            },
          });
        });
        return json({ ok: true });
      }
      if (method === "GET") {
        const url = new URL(req.url);
        const search = (url.searchParams.get("search") ?? "").slice(0, 200);
        const books = await db.book.findMany({
          where: {
            deletedAt: null,
            ...(id ? { id } : {}),
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { author: { contains: search, mode: "insensitive" } },
              { isbn: { contains: search } },
            ],
          },
          include: { cover: { select: { bookId: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        });
        return json(
          books.map(({ cover, ...b }) => ({
            ...b,
            coverUrl: cover ? `/api/books/${b.id}/cover` : null,
          })),
        );
      }
      await requireUser([...staff]);
      if (method === "POST" || method === "PATCH") {
        const input = bookSchema.parse(await req.json());
        const b = await db.$transaction(async (tx) => {
          if (id) {
            await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id}::uuid FOR UPDATE`;
            if (
              (await tx.loan.count({
                where: { bookId: id, returnedAt: null },
              })) &&
              input.available === true
            )
              throw new HttpError(
                409,
                "Confirme a devolução antes de disponibilizar o exemplar.",
              );
          }
          const b = id
            ? await tx.book.update({ where: { id }, data: input })
            : await tx.book.create({ data: input });
          await tx.audit.create({
            data: {
              actorId: actor.id,
              action: id ? "LIVRO_EDITADO" : "LIVRO_CRIADO",
              entityId: b.id,
              details: input,
            },
          });
          return b;
        });
        return json(b, method === "POST" ? 201 : 200);
      }
      if (method === "DELETE" && id) {
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id}::uuid FOR UPDATE`;
          if (await tx.loan.count({ where: { bookId: id, returnedAt: null } }))
            throw new HttpError(409, "Livro com empréstimo ativo.");
          await tx.book.update({
            where: { id },
            data: { deletedAt: new Date(), available: false },
          });
          await tx.audit.create({
            data: {
              actorId: actor.id,
              action: "LIVRO_EXCLUIDO",
              entityId: id,
              details: {},
            },
          });
        });
        return json({ ok: true });
      }
    }
    if (resource === "users") {
      await requireUser(["ADMIN"]);
      if (id) uuid.parse(id);
      if (method === "GET") {
        const users = await db.user.findMany({
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          take: 500,
        });
        return json(users.map(publicUser));
      }
      if (method === "POST") {
        const { password, ...input } = userSchema.parse(await req.json());
        const u = await db.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: { ...input, passwordHash: hashPassword(password) },
          });
          await tx.audit.create({
            data: {
              actorId: actor.id,
              action: "USUARIO_CRIADO",
              entityId: u.id,
              details: input,
            },
          });
          return u;
        });
        return json(publicUser(u), 201);
      }
      if (method === "PATCH" && id) {
        const schema = profileSchema.extend({
          role: z.enum(["ADMIN", "ALUNO", "BIBLIOTECARIO"]),
          blocked: z.boolean(),
        });
        const input = schema.parse(await req.json());
        if (id === actor.id && (input.role !== "ADMIN" || input.blocked))
          throw new HttpError(
            409,
            "Você não pode remover seu próprio acesso administrativo.",
          );
        const u = await db.$transaction(async (tx) => {
          const u = await tx.user.update({ where: { id }, data: input });
          await tx.session.deleteMany({ where: { userId: id } });
          await tx.audit.create({
            data: {
              actorId: actor.id,
              action: "USUARIO_EDITADO",
              entityId: id,
              details: input,
            },
          });
          return u;
        });
        return json(publicUser(u));
      }
      if (method === "DELETE" && id) {
        if (id === actor.id)
          throw new HttpError(409, "Você não pode excluir sua própria conta.");
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id}::uuid FOR UPDATE`;
          if (await tx.loan.count({ where: { userId: id, returnedAt: null } }))
            throw new HttpError(409, "Usuário com empréstimo pendente.");
          await tx.user.update({
            where: { id },
            data: { deletedAt: new Date() },
          });
          await tx.session.deleteMany({ where: { userId: id } });
          await tx.audit.create({
            data: {
              actorId: actor.id,
              action: "USUARIO_EXCLUIDO",
              entityId: id,
              details: {},
            },
          });
        });
        return json({ ok: true });
      }
    }
    if (resource === "loans") {
      if (method === "GET") {
        const rows = await db.loan.findMany({
          where: actor.role === "ALUNO" ? { userId: actor.id } : {},
          include: {
            book: { select: { title: true, author: true } },
            user: { select: { name: true, email: true } },
          },
          orderBy: { borrowedAt: "desc" },
          take: 500,
        });
        return json(
          rows.map((l) => ({
            ...l,
            fineCents: l.returnedAt ? l.fineCents : fineAt(l.dueAt),
          })),
        );
      }
      if (method === "POST") {
        await requireUser(["ALUNO"]);
        const { bookId } = z.object({ bookId: uuid }).parse(await req.json());
        return json(await borrow(actor.id, bookId), 201);
      }
      if (method === "PATCH" && id) {
        uuid.parse(id);
        const input = z
          .object({
            action: z.enum([
              "return",
              "renew",
              "deadline",
              "schedule",
              "confirm",
            ]),
            dueAt: z.iso.datetime().optional(),
          })
          .parse(await req.json());
        return json(
          await changeLoan(
            actor,
            id,
            input.action,
            input.dueAt ? new Date(input.dueAt) : undefined,
          ),
        );
      }
    }
    if (resource === "notificacoes") {
      if (method === "GET" && id) {
        uuid.parse(id);
        const n = await db.notification.findFirst({
          where: {
            id,
            ...(actor.role === "ALUNO"
              ? { deliveries: { some: { userId: actor.id } } }
              : {}),
          },
          include: {
            deliveries:
              actor.role === "ALUNO" ? { where: { userId: actor.id } } : true,
          },
        });
        if (!n) throw new HttpError(404, "Notificação não encontrada.");
        return json({
          id_notificacao: n.id,
          status: n.status,
          tentativas: Math.max(0, ...n.deliveries.map((d) => d.attempts)),
        });
      }
      if (method === "GET") {
        const rows = await db.notification.findMany({
          where:
            actor.role === "ALUNO"
              ? { deliveries: { some: { userId: actor.id } } }
              : {},
          include: {
            deliveries: {
              where: actor.role === "ALUNO" ? { userId: actor.id } : {},
              select: {
                id: true,
                channel: true,
                status: true,
                attempts: true,
                lastError: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return json(rows);
      }
    }
    throw new HttpError(404, "Recurso não encontrado.");
  } catch (e) {
    if (e instanceof HttpError) return json({ message: e.message }, e.status);
    if (e instanceof ZodError)
      return json({ message: e.issues[0]?.message ?? "Dados inválidos." }, 400);
    if (e instanceof SyntaxError)
      return json({ message: "JSON inválido." }, 400);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002")
        return json({ message: "E-mail, ISBN ou evento já cadastrado." }, 409);
      if (e.code === "P2025")
        return json({ message: "Registro não encontrado." }, 404);
    }
    console.error("SIGB API:", e instanceof Error ? e.name : "UnknownError");
    return json(
      {
        message:
          "Não foi possível concluir a operação. Verifique a conexão e tente novamente.",
      },
      500,
    );
  }
}
