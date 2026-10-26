import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.SIGB_TEST_API_URL;
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error(
    "Informe SIGB_TEST_API_URL de uma instância LOCAL ligada ao banco descartável.",
  );
const suffix = randomUUID();
async function call(path, method = "GET", body, cookie, extra = {}) {
  const headers = { ...extra, ...(cookie ? { Cookie: cookie } : {}) };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const r = await fetch(base + path, {
    method,
    headers,
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  let data;
  const content = r.headers.get("Content-Type");
  if (content?.includes("json")) data = await r.json();
  else data = await r.arrayBuffer();
  return {
    status: r.status,
    data,
    cookie: r.headers.get("Set-Cookie")?.split(";")[0],
  };
}
async function login(email, password) {
  const r = await call("/api/auth/login", "POST", { email, password });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.cookie);
  return r.cookie;
}
const password = "TestOnly-User-2026";
const admin = await login("admin@sigb.local", "TestOnly-Admin-2026");
assert.equal((await call("/api/users")).status, 401);
const input = {
  name: "Aluno HTTP",
  email: "http-" + suffix + "@test.local",
  password,
  role: "ALUNO",
  phone: "+5511999999999",
};
const created = await call("/api/users", "POST", input, admin);
assert.equal(created.status, 201);
const student = await login(input.email, password);
const otherData = { ...input, email: "other-" + suffix + "@test.local" };
assert.equal((await call("/api/users", "POST", otherData, admin)).status, 201);
const other = await login(otherData.email, password);
const staffData = {
  ...input,
  role: "BIBLIOTECARIO",
  email: "lib-" + suffix + "@test.local",
};
assert.equal((await call("/api/users", "POST", staffData, admin)).status, 201);
const staff = await login(staffData.email, password);
assert.equal((await call("/api/users", "GET", undefined, student)).status, 403);
assert.equal((await call("/api/users", "GET", undefined, staff)).status, 403);
assert.equal(
  (
    await call(
      "/api/profile",
      "PATCH",
      { name: "Novo Nome", email: input.email, phone: null, role: "ADMIN" },
      student,
    )
  ).data.role,
  "ALUNO",
);
const book = {
  title: "Livro HTTP",
  author: "Autor de Teste",
  isbn: suffix.replaceAll("-", ""),
  category: "Ciência",
  description: "Exemplar para teste de API",
  publisher: "SIGB",
  year: 2026,
  pages: 120,
};
assert.equal((await call("/api/books", "POST", book, student)).status, 403);
const saved = await call("/api/books", "POST", book, staff);
assert.equal(saved.status, 201);
const bookId = saved.data.id;
assert.equal(
  (
    await call("/api/books", "POST", book, staff, {
      Origin: "https://invalid.test",
    })
  ).status,
  403,
);
const file = new FormData();
file.set(
  "file",
  new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    { type: "image/png" },
  ),
  "cover.png",
);
assert.equal(
  (await call("/api/books/" + bookId + "/cover", "POST", file, staff)).status,
  200,
);
assert.equal(
  (await call("/api/books/" + bookId + "/cover", "GET", undefined, student))
    .status,
  200,
);
assert.equal((await call("/api/books/" + bookId + "/cover")).status, 401);
const borrowed = await call("/api/loans", "POST", { bookId }, student);
assert.equal(borrowed.status, 201);
const loanId = borrowed.data.id;
assert.equal((await call("/api/loans", "POST", { bookId }, other)).status, 409);
assert.equal(
  (await call("/api/loans", "GET", undefined, other)).data.length,
  0,
);
assert.equal(
  (await call("/api/loans/" + loanId, "PATCH", { action: "return" }, student))
    .status,
  403,
);
assert.equal(
  (
    await call(
      "/api/books/" + bookId,
      "PATCH",
      { ...book, available: true },
      staff,
    )
  ).status,
  409,
);
assert.equal(
  (
    await call(
      "/api/loans/" + loanId,
      "PATCH",
      {
        action: "schedule",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      },
      staff,
    )
  ).status,
  200,
);
assert.equal(
  (await call("/api/loans/" + loanId, "PATCH", { action: "confirm" }, staff))
    .status,
  200,
);
assert.equal(
  (await call("/api/loans/" + loanId, "PATCH", { action: "renew" }, student))
    .status,
  200,
);
assert.equal(
  (await call("/api/books/" + bookId, "DELETE", undefined, admin)).status,
  409,
);
assert.equal(
  (await call("/api/users/" + created.data.id, "DELETE", undefined, admin))
    .status,
  409,
);
const event = {
  eventKey: "http-" + suffix,
  type: "PRAZO_PROXIMO",
  message: "Teste HTTP",
  recipientIds: [created.data.id],
  channels: ["EMAIL", "SMS", "WHATSAPP"],
};
assert.equal((await call("/webhooks/notificacoes", "POST", event)).status, 401);
const webhookHeaders = { Authorization: "Bearer sigb-local-test-token" };
const received = await call(
  "/webhooks/notificacoes",
  "POST",
  event,
  undefined,
  webhookHeaders,
);
assert.equal(received.status, 202);
assert.equal(
  (
    await call(
      "/webhooks/notificacoes",
      "POST",
      event,
      undefined,
      webhookHeaders,
    )
  ).data.id_notificacao,
  received.data.id_notificacao,
);
assert.equal(
  (
    await call(
      "/notificacoes/" + received.data.id_notificacao,
      "GET",
      undefined,
      student,
    )
  ).data.status,
  "PROCESSANDO",
);
assert.equal(
  (
    await call(
      "/notificacoes/" + received.data.id_notificacao,
      "GET",
      undefined,
      other,
    )
  ).status,
  404,
);
assert.equal(
  (await call("/api/loans/" + loanId, "PATCH", { action: "return" }, staff))
    .status,
  200,
);
assert.equal(
  (await call("/api/books/" + bookId, "DELETE", undefined, admin)).status,
  200,
);
assert.equal(
  (await call("/api/users/" + created.data.id, "DELETE", undefined, admin))
    .status,
  200,
);
assert.equal(
  (await call("/api/auth/me", "GET", undefined, student)).data,
  null,
);
console.info(
  "API HTTP OK: login, sessões, permissões dos 3 perfis, proteção de origem, upload binário, empréstimo, agendamento, confirmação, renovação, devolução, exclusão lógica e webhook idempotente.",
);
