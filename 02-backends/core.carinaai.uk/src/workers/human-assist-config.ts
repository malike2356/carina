export function humanAssistEnabled(): boolean {
  const raw = process.env.AIVA_HUMAN_ASSIST_ENABLED;
  if (raw == null || raw === '') return true;
  return !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase());
}

export function humanAssistFairUsePerMonth(): number {
  const n = Number(process.env.AIVA_HUMAN_ASSIST_FAIR_USE_PER_MONTH ?? '5');
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5;
}
