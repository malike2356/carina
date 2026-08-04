export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() ?? '';
}

export function isDatabaseConfigured(): boolean {
  return resolveDatabaseUrl().length > 0;
}
