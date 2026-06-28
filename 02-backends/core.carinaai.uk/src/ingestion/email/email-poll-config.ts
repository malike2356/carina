export function emailPollCronExpression(): string {
  return process.env.AIVA_EMAIL_POLL_CRON?.trim() || '*/5 * * * *';
}

export function emailPollLimit(): number {
  const n = Number(process.env.AIVA_EMAIL_POLL_LIMIT ?? 25);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 25;
}
