import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const dir = dirname(fileURLToPath(import.meta.url));

export const emailDeliverabilityPolicy = JSON.parse(
  readFileSync(join(dir, 'policy.json'), 'utf8'),
) as EmailDeliverabilityPolicy;

export default emailDeliverabilityPolicy;
