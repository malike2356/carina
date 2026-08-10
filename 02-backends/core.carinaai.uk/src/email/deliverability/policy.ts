export type EmailDeliverabilityPolicy = {
  version: string;
  thresholds: {
    inboxRateMinPct: number;
    spamComplaintRateMaxPct: number;
    bounceRateMaxPct: number;
  };
  dmarcLadder: Array<'none' | 'quarantine' | 'reject'>;
  warmup: {
    startPerDay: number;
    doubleEveryDays: number;
    maxDays: number;
  };
  domainRoles: {
    transactionalSubdomains: string[];
    marketingSubdomains: string[];
  };
  note: string;
};

/** Keep in sync with policy.json (canonical shared values). */
export const emailDeliverabilityPolicy: EmailDeliverabilityPolicy = {
  version: '1.0.0',
  thresholds: {
    inboxRateMinPct: 99.0,
    spamComplaintRateMaxPct: 0.1,
    bounceRateMaxPct: 2.0,
  },
  dmarcLadder: ['none', 'quarantine', 'reject'],
  warmup: {
    startPerDay: 50,
    doubleEveryDays: 3,
    maxDays: 28,
  },
  domainRoles: {
    transactionalSubdomains: ['mail', 'receipts', 'noreply'],
    marketingSubdomains: ['updates', 'news', 'hello'],
  },
  note:
    'Inbox placement requires ESP or Postmaster signals; until then inboxRate uses delivered/(delivered+spam+bounce) as a conservative proxy and must be labelled as such.',
};

export default emailDeliverabilityPolicy;
