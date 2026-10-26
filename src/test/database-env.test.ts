import { describe, it, expect } from "vitest";
import {
  databaseUrl,
  migrationDatabaseUrl,
} from "../core/services/server/database-env.mjs";
const pooled = "postgresql://example.invalid/pooled";
const direct = "postgresql://example.invalid/direct";
describe("conexão Postgres da Vercel", () => {
  it("usa DATABASE_URL quando definida", () => {
    expect(databaseUrl({ DATABASE_URL: pooled, POSTGRES_URL: direct })).toBe(
      pooled,
    );
  });
  it("reconhece os aliases de Postgres da integração", () => {
    for (const key of [
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL",
      "POSTGRES_URL_NON_POOLING",
      "DATABASE_URL_UNPOOLED",
    ])
      expect(databaseUrl({ [key]: pooled })).toBe(pooled);
  });
  it("ignora valores vazios sem ligar a demonstração indevidamente", () => {
    expect(databaseUrl({ DATABASE_URL: "  ", POSTGRES_URL: pooled })).toBe(
      pooled,
    );
    expect(databaseUrl({})).toBeUndefined();
  });
  it("prefere conexão direta para migração e mantém pooling na aplicação", () => {
    const env = { DATABASE_URL: pooled, POSTGRES_URL_NON_POOLING: direct };
    expect(databaseUrl(env)).toBe(pooled);
    expect(migrationDatabaseUrl(env)).toBe(direct);
  });
  it("permite migração com a única conexão fornecida", () => {
    expect(migrationDatabaseUrl({ POSTGRES_URL: pooled })).toBe(pooled);
  });
});
