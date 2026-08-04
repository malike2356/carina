import type { ShieldMessage, ShieldPolicy, ShieldVerdict } from './types.js';

export interface StageScores {
  identity: number;
  url: number;
  staticScan: number;
  agent: number;
  sandbox: number;
  error?: string;
  flags: string[];
}

const EICAR_MARKERS = [
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
];

const DANGEROUS_EXTS = ['.exe', '.scr', '.bat', '.cmd', '.js', '.vbs', '.ps1', '.msi', '.dll'];

export function scoreIdentity(authSignals: Record<string, unknown>): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  const spf = String(authSignals.spf ?? authSignals.SPF ?? '').toLowerCase();
  const dkim = String(authSignals.dkim ?? authSignals.DKIM ?? '').toLowerCase();
  const dmarc = String(authSignals.dmarc ?? authSignals.DMARC ?? '').toLowerCase();
  if (spf === 'fail' || spf === 'softfail') {
    score += 35;
    flags.push('spf_fail');
  }
  if (dkim === 'fail') {
    score += 25;
    flags.push('dkim_fail');
  }
  if (dmarc === 'fail') {
    score += 40;
    flags.push('dmarc_fail');
  }
  if (authSignals.spoofLikely === true || authSignals.lookalike === true) {
    score += 45;
    flags.push('lookalike');
  }
  if (authSignals.signatureValid === false) {
    score += 30;
    flags.push('bad_signature');
  }
  return { score: Math.min(score, 100), flags };
}

export function scoreUrls(links: string[], text: string): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  const blocklist = (process.env.CHANNEL_SHIELD_URL_BLOCKLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const hay = `${links.join(' ')} ${text}`.toLowerCase();
  for (const domain of blocklist) {
    if (hay.includes(domain)) {
      score += 60;
      flags.push(`blocklist:${domain}`);
    }
  }
  const urlCount = links.length || (hay.match(/https?:\/\//g) ?? []).length;
  if (urlCount >= 5) {
    score += 15;
    flags.push('many_urls');
  }
  if (/bit\.ly|tinyurl|t\.co\/|goo\.gl/i.test(hay)) {
    score += 20;
    flags.push('shortener');
  }
  return { score: Math.min(score, 100), flags };
}

export function scoreStatic(
  attachments: Array<{ filename: string; contentType: string; sha256?: string }>,
  text: string,
  policy: ShieldPolicy,
): { score: number; flags: string[]; eicar: boolean } {
  const flags: string[] = [];
  let score = 0;
  let eicar = false;
  const blob = text;
  for (const marker of EICAR_MARKERS) {
    if (blob.includes(marker)) {
      eicar = true;
      score = 100;
      flags.push('eicar');
      break;
    }
  }
  for (const a of attachments) {
    const lower = a.filename.toLowerCase();
    if (DANGEROUS_EXTS.some((ext) => lower.endsWith(ext))) {
      score = Math.max(score, 80);
      flags.push(`dangerous_ext:${a.filename}`);
    }
    if (policy.sandboxFileTypes.includes(a.contentType) && a.contentType.includes('msdownload')) {
      score = Math.max(score, 70);
      flags.push(`risky_type:${a.contentType}`);
    }
    if (a.sha256 && process.env.CHANNEL_SHIELD_HASH_BLOCKLIST?.includes(a.sha256)) {
      score = 100;
      flags.push('hash_blocklist');
    }
  }
  return { score: Math.min(score, 100), flags, eicar };
}

export function scoreAgentHeuristics(text: string, subject?: string): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  const hay = `${subject ?? ''} ${text}`.toLowerCase();
  const phish = [
    'urgent action required',
    'verify your account',
    'password expires',
    'wire transfer',
    'gift card',
    'click here immediately',
    'confirm your identity',
    'suspended account',
  ];
  for (const p of phish) {
    if (hay.includes(p)) {
      score += 25;
      flags.push(`phish_phrase:${p}`);
    }
  }
  return { score: Math.min(score, 100), flags };
}

export function combineVerdict(
  stages: StageScores,
  policy: ShieldPolicy,
): { verdict: ShieldVerdict; riskScore: number } {
  if (stages.error) {
    return { verdict: 'error', riskScore: 100 };
  }
  const riskScore = Math.min(
    100,
    Math.max(
      stages.identity,
      stages.url,
      stages.staticScan,
      stages.agent,
      stages.sandbox,
      Math.round(
        stages.identity * 0.25 +
          stages.url * 0.2 +
          stages.staticScan * 0.3 +
          stages.agent * 0.15 +
          stages.sandbox * 0.1,
      ),
    ),
  );

  if (
    stages.flags.includes('eicar') ||
    stages.flags.some((f) => f.startsWith('hash_blocklist')) ||
    stages.staticScan >= 90 ||
    stages.sandbox >= 90 ||
    (stages.identity >= 70 && stages.agent >= 50)
  ) {
    return { verdict: 'malicious', riskScore: Math.max(riskScore, 90) };
  }
  if (riskScore >= 55 || stages.flags.length >= 2) {
    return { verdict: 'suspect', riskScore };
  }
  return { verdict: 'clean', riskScore };
}

export function buildSafeSummary(
  message: ShieldMessage,
  verdict: ShieldVerdict,
  appBaseUrl?: string,
): string {
  const base = (appBaseUrl ?? process.env.APP_URL ?? 'https://app.carinaai.uk').replace(/\/$/, '');
  const link = `${base}/settings/channel-shield?message=${message.id}`;
  const channel = message.channel;
  const from = message.envelope.from.display ?? message.envelope.from.id;
  const subject = message.envelope.subject ? ` Subject: ${message.envelope.subject}.` : '';
  return (
    `Channel Shield held a ${channel} message from ${from} (${verdict}).` +
    `${subject} Live payload and attachments are not delivered.` +
    ` Review: ${link}`
  );
}

export function shouldFailClosed(
  verdict: ShieldVerdict,
  policy: ShieldPolicy,
): boolean {
  if (verdict === 'malicious' && policy.failClosedOnMalicious) return true;
  if (verdict === 'error' && policy.failClosedOnError) return true;
  if (verdict === 'suspect' && !policy.autoReleaseSuspects) return true;
  return false;
}
