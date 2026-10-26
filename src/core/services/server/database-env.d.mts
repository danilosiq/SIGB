type DatabaseEnvironment = Record<string, string | undefined>;
export function databaseUrl(env?: DatabaseEnvironment): string | undefined;
export function migrationDatabaseUrl(
  env?: DatabaseEnvironment,
): string | undefined;
