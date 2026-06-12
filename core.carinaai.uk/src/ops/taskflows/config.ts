const DEFAULT_RUN_TIMEOUT_MS = 15 * 60_000;

export function runTimeoutMs(): number {
  const raw = Number(process.env.CARINA_TASKFLOWS_RUN_TIMEOUT_MS ?? DEFAULT_RUN_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RUN_TIMEOUT_MS;
}
