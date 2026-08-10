/**
 * Delivery event tracking, rates, bounce analysis, and health alerts.
 */

import policy from './policy.js';

export type DeliveryEventKind =
  | 'delivered'
  | 'bounced'
  | 'spam'
  | 'complained'
  | 'opened'
  | 'clicked'
  | 'blocked'
  | 'deferred';

export type DeliveryEvent = {
  emailId: string;
  domain: string;
  kind: DeliveryEventKind;
  at: string;
  bounceClass?: BounceClass;
  meta?: Record<string, string>;
};

export type BounceClass = 'hard' | 'soft' | 'block';

export type DeliveryStore = {
  events: DeliveryEvent[];
};

export function createDeliveryStore(): DeliveryStore {
  return { events: [] };
}

export function trackDelivery(
  store: DeliveryStore,
  event: Omit<DeliveryEvent, 'at'> & { at?: string },
): DeliveryEvent {
  const row: DeliveryEvent = {
    ...event,
    at: event.at ?? new Date().toISOString(),
    bounceClass:
      event.bounceClass
      ?? (event.kind === 'bounced' ? classifyBounce(event.meta?.reason) : undefined),
  };
  store.events.push(row);
  // Cap growth for in-memory stores.
  if (store.events.length > 50_000) {
    store.events = store.events.slice(-40_000);
  }
  return row;
}

export function classifyBounce(reason?: string): BounceClass {
  const text = (reason ?? '').toLowerCase();
  if (!text) return 'soft';
  if (
    /invalid|unknown user|no such user|does not exist|mailbox unavailable|550 5\.1\.1|user unknown/.test(
      text,
    )
  ) {
    return 'hard';
  }
  if (/reputation|blocked|blacklist|denied|550 5\.7\.1|spamhaus|block list/.test(text)) {
    return 'block';
  }
  return 'soft';
}

export type RateWindow = { since: string; until: string };

function inRange(iso: string, range: RateWindow): boolean {
  const t = Date.parse(iso);
  return t >= Date.parse(range.since) && t <= Date.parse(range.until);
}

export function calculateInboxRate(
  store: DeliveryStore,
  domain: string,
  dateRange: RateWindow,
): {
  inboxRatePct: number | null;
  delivered: number;
  spam: number;
  bounced: number;
  proxyNote: string;
} {
  const rows = store.events.filter(
    (e) => e.domain === domain && inRange(e.at, dateRange),
  );
  const delivered = rows.filter((e) => e.kind === 'delivered' || e.kind === 'opened').length;
  const spam = rows.filter((e) => e.kind === 'spam' || e.kind === 'complained').length;
  const bounced = rows.filter((e) => e.kind === 'bounced' || e.kind === 'blocked').length;
  const denom = delivered + spam + bounced;
  return {
    inboxRatePct: denom > 0 ? Math.round((1000 * delivered) / denom) / 10 : null,
    delivered,
    spam,
    bounced,
    proxyNote: policy.note,
  };
}

export function calculateSpamComplaintRate(
  store: DeliveryStore,
  domain: string,
  dateRange: RateWindow,
): { complaintRatePct: number | null; complaints: number; sentLike: number } {
  const rows = store.events.filter(
    (e) => e.domain === domain && inRange(e.at, dateRange),
  );
  const complaints = rows.filter((e) => e.kind === 'complained' || e.kind === 'spam').length;
  const sentLike = rows.filter((e) =>
    ['delivered', 'opened', 'clicked', 'bounced', 'spam', 'complained', 'blocked'].includes(e.kind),
  ).length;
  return {
    complaintRatePct: sentLike > 0 ? Math.round((10000 * complaints) / sentLike) / 100 : null,
    complaints,
    sentLike,
  };
}

export function bounceAnalysis(store: DeliveryStore, domain?: string): {
  hard: number;
  soft: number;
  block: number;
  samples: DeliveryEvent[];
} {
  const bounced = store.events.filter(
    (e) =>
      (e.kind === 'bounced' || e.kind === 'blocked')
      && (!domain || e.domain === domain),
  );
  return {
    hard: bounced.filter((e) => e.bounceClass === 'hard').length,
    soft: bounced.filter((e) => e.bounceClass === 'soft').length,
    block: bounced.filter((e) => e.bounceClass === 'block' || e.kind === 'blocked').length,
    samples: bounced.slice(-20),
  };
}

export type HealthAlert = {
  code: 'spam_complaint_high' | 'inbox_rate_low' | 'bounce_rate_high';
  message: string;
  value: number;
  threshold: number;
};

export function deliveryHealthCheck(
  store: DeliveryStore,
  domain: string,
  dateRange: RateWindow,
): {
  ok: boolean;
  inboxRatePct: number | null;
  spamComplaintRatePct: number | null;
  bounceRatePct: number | null;
  alerts: HealthAlert[];
  thresholds: typeof policy.thresholds;
} {
  const inbox = calculateInboxRate(store, domain, dateRange);
  const spam = calculateSpamComplaintRate(store, domain, dateRange);
  const bounce = bounceAnalysis(store, domain);
  const bounceDenom = Math.max(inbox.delivered + inbox.bounced, 1);
  const bounceRatePct =
    inbox.delivered + inbox.bounced > 0
      ? Math.round((1000 * bounce.hard + 1000 * bounce.block) / bounceDenom) / 10
      : null;

  const alerts: HealthAlert[] = [];
  if (
    spam.complaintRatePct != null
    && spam.complaintRatePct > policy.thresholds.spamComplaintRateMaxPct
  ) {
    alerts.push({
      code: 'spam_complaint_high',
      message: `Spam complaint rate ${spam.complaintRatePct}% exceeds ${policy.thresholds.spamComplaintRateMaxPct}%`,
      value: spam.complaintRatePct,
      threshold: policy.thresholds.spamComplaintRateMaxPct,
    });
  }
  if (
    inbox.inboxRatePct != null
    && inbox.inboxRatePct < policy.thresholds.inboxRateMinPct
  ) {
    alerts.push({
      code: 'inbox_rate_low',
      message: `Inbox placement proxy ${inbox.inboxRatePct}% below ${policy.thresholds.inboxRateMinPct}%`,
      value: inbox.inboxRatePct,
      threshold: policy.thresholds.inboxRateMinPct,
    });
  }
  if (
    bounceRatePct != null
    && bounceRatePct > policy.thresholds.bounceRateMaxPct
  ) {
    alerts.push({
      code: 'bounce_rate_high',
      message: `Hard/block bounce rate ${bounceRatePct}% exceeds ${policy.thresholds.bounceRateMaxPct}%`,
      value: bounceRatePct,
      threshold: policy.thresholds.bounceRateMaxPct,
    });
  }

  return {
    ok: alerts.length === 0,
    inboxRatePct: inbox.inboxRatePct,
    spamComplaintRatePct: spam.complaintRatePct,
    bounceRatePct,
    alerts,
    thresholds: policy.thresholds,
  };
}
