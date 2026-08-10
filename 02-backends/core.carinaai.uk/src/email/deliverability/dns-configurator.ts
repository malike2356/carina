/**
 * SPF / DKIM / DMARC record generation and DNS validation.
 * Pure helpers; products wire ESP APIs and ops UIs.
 */

import dns from 'node:dns/promises';
import crypto from 'node:crypto';

export type SendingService =
  | 'resend'
  | 'sendgrid'
  | 'ses'
  | 'mailgun'
  | 'custom';

export type DmarcPolicy = 'none' | 'quarantine' | 'reject';

export type DnsTxtRecord = {
  host: string;
  type: 'TXT';
  value: string;
  purpose: 'spf' | 'dkim' | 'dmarc';
};

const SPF_INCLUDES: Record<SendingService, string | null> = {
  resend: 'include:_spf.resend.com',
  sendgrid: 'include:sendgrid.net',
  ses: 'include:amazonses.com',
  mailgun: 'include:mailgun.org',
  custom: null,
};

export function generateSPFRecord(
  domain: string,
  sendingServices: SendingService[],
): DnsTxtRecord {
  const includes = sendingServices
    .map((s) => SPF_INCLUDES[s])
    .filter((v): v is string => Boolean(v));
  const unique = [...new Set(includes)];
  const value = `v=spf1 ${unique.join(' ')} ~all`.replace(/\s+/g, ' ').trim();
  return {
    host: domain.trim().toLowerCase() === domain ? '@' : domain,
    type: 'TXT',
    value,
    purpose: 'spf',
  };
}

export function generateDKIMRecord(
  domain: string,
  selector = 'mail',
): { privateKeyPem: string; publicKeyPem: string; record: DnsTxtRecord } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const pub = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const value = `v=DKIM1; k=rsa; p=${pub}`;
  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    record: {
      host: `${selector}._domainkey`,
      type: 'TXT',
      value,
      purpose: 'dkim',
    },
  };
}

export function generateDMARCRecord(
  domain: string,
  policy: DmarcPolicy = 'none',
  opts?: { rua?: string; ruf?: string; subdomainPolicy?: DmarcPolicy },
): DnsTxtRecord {
  const parts = [
    'v=DMARC1',
    `p=${policy}`,
    opts?.subdomainPolicy ? `sp=${opts.subdomainPolicy}` : null,
    opts?.rua ? `rua=mailto:${opts.rua}` : null,
    opts?.ruf ? `ruf=mailto:${opts.ruf}` : null,
    'adkim=s',
    'aspf=s',
  ].filter(Boolean);
  return {
    host: `_dmarc.${domain}`.replace(/^_dmarc\._dmarc\./, '_dmarc.'),
    type: 'TXT',
    value: `${parts.join('; ')};`,
    purpose: 'dmarc',
  };
}

export type DnsValidationResult = {
  domain: string;
  spf: { ok: boolean; records: string[]; detail: string };
  dkim: { ok: boolean; records: string[]; detail: string; selector: string };
  dmarc: { ok: boolean; records: string[]; detail: string; policy: string | null };
  allOk: boolean;
};

async function lookupTxt(name: string): Promise<string[]> {
  try {
    const rows = await dns.resolveTxt(name);
    return rows.map((parts) => parts.join(''));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENODATA' || code === 'ENOTFOUND') return [];
    throw err;
  }
}

export async function validateDNSRecords(
  domain: string,
  opts?: { dkimSelector?: string; resolver?: typeof lookupTxt },
): Promise<DnsValidationResult> {
  const root = domain.trim().toLowerCase().replace(/\.$/, '');
  const lookup = opts?.resolver ?? lookupTxt;
  const selector = opts?.dkimSelector ?? 'mail';

  const spfRecords = (await lookup(root)).filter((r) => /v=spf1/i.test(r));
  const dkimRecords = (await lookup(`${selector}._domainkey.${root}`)).filter((r) =>
    /v=DKIM1|p=/i.test(r),
  );
  const dmarcRecords = (await lookup(`_dmarc.${root}`)).filter((r) => /v=DMARC1/i.test(r));

  const dmarcPolicy =
    dmarcRecords
      .map((r) => {
        const m = r.match(/\bp=(none|quarantine|reject)\b/i);
        return m?.[1]?.toLowerCase() ?? null;
      })
      .find(Boolean) ?? null;

  const spf = {
    ok: spfRecords.length > 0,
    records: spfRecords,
    detail: spfRecords.length
      ? 'SPF TXT found'
      : 'No SPF TXT (v=spf1) on apex',
  };
  const dkim = {
    ok: dkimRecords.some((r) => /p=[A-Za-z0-9+/=]+/.test(r)),
    records: dkimRecords,
    detail: dkimRecords.length
      ? `DKIM TXT found for selector ${selector}`
      : `No DKIM TXT at ${selector}._domainkey.${root}`,
    selector,
  };
  const dmarc = {
    ok: dmarcRecords.length > 0 && Boolean(dmarcPolicy),
    records: dmarcRecords,
    detail: dmarcRecords.length
      ? `DMARC present (p=${dmarcPolicy})`
      : 'No DMARC TXT at _dmarc.' + root,
    policy: dmarcPolicy,
  };

  return {
    domain: root,
    spf,
    dkim,
    dmarc,
    allOk: spf.ok && dkim.ok && dmarc.ok,
  };
}

export function generateSetupGuide(input: {
  domain: string;
  transactionalDomain: string;
  marketingDomain: string;
  sendingServices: SendingService[];
  dmarcPolicy?: DmarcPolicy;
  dkimSelector?: string;
  rua?: string;
}): string {
  const spf = generateSPFRecord(input.transactionalDomain, input.sendingServices);
  const dkim = generateDKIMRecord(input.transactionalDomain, input.dkimSelector ?? 'mail');
  const dmarc = generateDMARCRecord(input.transactionalDomain, input.dmarcPolicy ?? 'none', {
    rua: input.rua,
    subdomainPolicy: 'none',
  });
  const lines = [
    `# Email DNS setup for ${input.domain}`,
    '',
    'Transactional sender: `' + input.transactionalDomain + '`',
    'Marketing sender: `' + input.marketingDomain + '` (separate identity; do not reuse transactional DNS for marketing campaigns)',
    '',
    '## 1. SPF',
    `- Host: ${spf.host === '@' ? input.transactionalDomain : spf.host}`,
    `- Type: TXT`,
    `- Value: \`${spf.value}\``,
    '',
    '## 2. DKIM (2048-bit)',
    `- Host: ${dkim.record.host}.${input.transactionalDomain}`,
    `- Type: TXT`,
    `- Value: \`${dkim.record.value.slice(0, 80)}...\` (use full public key from generator output)`,
    '- Store the private key only in the ESP or vault; never commit it.',
    '',
    '## 3. DMARC (start at p=none)',
    `- Host: ${dmarc.host}`,
    `- Type: TXT`,
    `- Value: \`${dmarc.value}\``,
    '- Progression: p=none (monitor) -> p=quarantine -> p=reject after clean reports.',
    '',
    '## 4. Verify',
    '- Wait for DNS TTL propagation (often under 1 hour; up to 48h).',
    '- Run `validateDNSRecords("' + input.transactionalDomain + '")` from the product ops tool.',
    '- Confirm the ESP domain status (Resend / SendGrid / SES) shows verified.',
    '',
    '## 5. Warm-up',
    '- Start at 50 sends/day on the new domain; double every 3 days for 2-4 weeks.',
  ];
  return lines.join('\n');
}
