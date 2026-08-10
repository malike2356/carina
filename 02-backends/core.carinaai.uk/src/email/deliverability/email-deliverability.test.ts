/**
 * Shared email deliverability helpers (hermetic unit tests).
 */
import { describe, expect, it } from 'vitest';
import {
  generateSPFRecord,
  generateDKIMRecord,
  generateDMARCRecord,
  validateDNSRecords,
  configureTransactionalDomain,
  configureMarketingDomain,
  warmUpDomain,
  enforceDomainSeparation,
  createDeliveryStore,
  trackDelivery,
  classifyBounce,
  deliveryHealthCheck,
  calculateSpamComplaintRate,
} from './index.js';

describe('shared email deliverability', () => {
  it('generates SPF, 2048-bit DKIM, and DMARC p=none', () => {
    const spf = generateSPFRecord('mail.example.com', ['resend']);
    expect(spf.value).toContain('v=spf1');
    expect(spf.value).toContain('include:_spf.resend.com');

    const dkim = generateDKIMRecord('mail.example.com', 'mail');
    expect(dkim.privateKeyPem).toContain('PRIVATE KEY');
    expect(dkim.record.value).toMatch(/v=DKIM1/);
    expect(dkim.record.value.length).toBeGreaterThan(200);

    const dmarc = generateDMARCRecord('mail.example.com', 'none', {
      rua: 'dmarc@example.com',
    });
    expect(dmarc.value).toContain('p=none');
    expect(dmarc.host).toContain('_dmarc');
  });

  it('validates DNS via injectable resolver', async () => {
    const result = await validateDNSRecords('mail.example.com', {
      dkimSelector: 'mail',
      resolver: async (name) => {
        if (name === 'mail.example.com') return ['v=spf1 include:_spf.resend.com ~all'];
        if (name === 'mail._domainkey.mail.example.com') {
          return ['v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA'];
        }
        if (name === '_dmarc.mail.example.com') return ['v=DMARC1; p=none;'];
        return [];
      },
    });
    expect(result.allOk).toBe(true);
    expect(result.dmarc.policy).toBe('none');
  });

  it('separates transactional and marketing domains and blocks cross-send', () => {
    const tx = configureTransactionalDomain('app.example.com');
    const mkt = configureMarketingDomain('app.example.com');
    expect(tx.sendingDomain).toBe('mail.app.example.com');
    expect(mkt.sendingDomain).toBe('updates.app.example.com');
    expect(tx.sendingDomain).not.toBe(mkt.sendingDomain);

    expect(() =>
      enforceDomainSeparation('marketing', `news@${tx.sendingDomain}`, 'app.example.com'),
    ).toThrow(/must not use the transactional/);

    const plan = warmUpDomain(tx.sendingDomain);
    expect(plan.days[0]?.dailyCap).toBe(50);
    expect(plan.days.some((d) => d.dailyCap >= 100)).toBe(true);
  });

  it('tracks delivery metrics and alerts on spam/inbox thresholds', () => {
    const store = createDeliveryStore();
    const domain = 'mail.example.com';
    const since = '2026-08-01T00:00:00.000Z';
    const until = '2026-08-10T00:00:00.000Z';
    for (let i = 0; i < 100; i += 1) {
      trackDelivery(store, {
        emailId: `e${i}`,
        domain,
        kind: i < 97 ? 'delivered' : 'complained',
        at: '2026-08-05T12:00:00.000Z',
      });
    }
    const spam = calculateSpamComplaintRate(store, domain, { since, until });
    expect(spam.complaintRatePct).toBeGreaterThan(0.1);
    const health = deliveryHealthCheck(store, domain, { since, until });
    expect(health.alerts.some((a) => a.code === 'spam_complaint_high')).toBe(true);
    expect(classifyBounce('550 5.1.1 user unknown')).toBe('hard');
    expect(classifyBounce('blocked by spamhaus')).toBe('block');
    expect(classifyBounce('mailbox full')).toBe('soft');
  });
});
