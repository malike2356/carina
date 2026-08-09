/**
 * In-process counters for outreach observability (process lifetime).
 * Prefer DB-backed health for durable queue depth; these catch webhook/signature storms.
 */

type CounterMap = Record<string, number>;

const counters: CounterMap = {
  webhookSignatureFailures: 0,
  providerEventsApplied: 0,
  providerEventsRejected: 0,
  providerEventsDuplicate: 0,
  sendSuccess: 0,
  sendFailure: 0,
  mailboxSyncFailures: 0,
  repliesMatched: 0,
  repliesUnmatched: 0,
  repliesAmbiguous: 0,
  suppressionEvents: 0,
};

export function bumpOutreachCounter(name: keyof typeof counters, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function getOutreachCounters(): CounterMap {
  return { ...counters };
}

export function resetOutreachCountersForTests(): void {
  for (const key of Object.keys(counters)) counters[key] = 0;
}
