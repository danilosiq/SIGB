/** Resolve integração Vercel/Neon sem copiar nem registrar credenciais. */
export function databaseUrl(env = process.env) {
  return [
    env.DATABASE_URL,
    env.POSTGRES_PRISMA_URL,
    env.POSTGRES_URL,
    env.POSTGRES_URL_NON_POOLING,
    env.DATABASE_URL_UNPOOLED,
  ]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}

/** O CLI utiliza a conexão direta quando a integração a disponibiliza. */
export function migrationDatabaseUrl(env = process.env) {
  return (
    [env.DIRECT_URL, env.POSTGRES_URL_NON_POOLING, env.DATABASE_URL_UNPOOLED]
      .find((value) => typeof value === "string" && value.trim())
      ?.trim() ?? databaseUrl(env)
  );
}
