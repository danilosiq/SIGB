import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { db } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function checkPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function currentUser() {
  const token = (await cookies()).get("sigb-session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { user: true },
  });
  return session && session.expiresAt > new Date() && !session.user.deletedAt
    ? session.user
    : null;
}
export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Entre na sua conta para continuar.");
  if (roles && !roles.includes(user.role))
    throw new HttpError(403, "Seu perfil não tem permissão para esta ação.");
  return user;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, "Origem não autorizada.");
}
export function webhookAuth(req: Request) {
  const key = process.env.WEBHOOK_SECRET;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !key ||
    !timingSafeEqual(Buffer.from(digest(token)), Buffer.from(digest(key)))
  )
    throw new HttpError(401, "Token de integração inválido.");
}
export const publicUser = (u: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  blocked: boolean;
}) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  blocked: u.blocked,
});
