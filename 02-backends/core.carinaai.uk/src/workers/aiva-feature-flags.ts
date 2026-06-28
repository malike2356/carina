export function isEmailIngestionEnabled(): boolean {
  return process.env.EMAIL_INGESTION_ENABLED === 'true';
}

export function isPropreneurBridgeEnabled(): boolean {
  return process.env.PROPREENEUR_BRIDGE_ENABLED === 'true';
}

export function isPropreneurBridgeWritesEnabled(): boolean {
  return process.env.PROPREENEUR_BRIDGE_WRITES === 'true';
}

export function isAivaDailySummaryEnabled(): boolean {
  return process.env.AIVA_DAILY_SUMMARY_ENABLED === 'true';
}
