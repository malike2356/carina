import { Router } from 'express';
import {
  carinaGet,
  carinaJson,
  carinaOpsTokenSet,
  carinaPost,
} from '../lib/carina.js';
import { hrefWithUiVersion } from '../lib/callback-url.js';

export const hostedEmailRouter = Router();

const uiVersion = process.env.UI_VERSION ?? '20260719d';
const DOMAIN_ID = 'integration:aiva-hosted-email';

/** Shown in password inputs when a secret is already stored (Core never returns plaintext). */
const SECRET_MASK = '••••••••••••••••';

type HostedEmailStatus = {
  enabled?: boolean;
  domain?: string;
  provider?: string;
  inboundSecretPresent?: boolean;
  signingKeyPresent?: boolean;
  lastInboundAt?: string | null;
  unknownRecipientCount?: number;
  acceptedCount?: number;
};

type HostedEmailSettings = {
  fields?: Array<{
    key: string;
    currentValue?: string;
  }>;
};

type HostedEmailPageState = {
  enabled: boolean;
  domain: string;
  provider: string;
  secretPresent: boolean;
  cloudflareSecretDisplay: string;
  mailgunSecretDisplay: string;
  lastInboundAt: string | null;
  unknownRecipientCount: number;
  acceptedCount: number;
  inboundUrl: string;
  workerDomain: string;
  error?: string;
};

function isUnchangedSecret(submitted: string): boolean {
  const next = submitted.trim();
  if (!next) return true;
  if (next === SECRET_MASK) return true;
  if (/^[•*]{8,}$/.test(next)) return true;
  return false;
}

function hostedEmailRedirect(query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  return hrefWithUiVersion(`/hosted-email?${params.toString()}`, uiVersion);
}

function appBaseUrl(): string {
  return (
    process.env.CARINA_HOSTED_APP_URL
    ?? process.env.AIVA_APP_PUBLIC_URL
    ?? 'https://admin.hireaiva.co.uk'
  ).replace(/\/$/, '');
}

function readField(settings: HostedEmailSettings | null, key: string): string {
  const found = settings?.fields?.find((field) => field.key === key);
  const value = found?.currentValue ?? '';
  return value === '[not set]' || value === '[set]' ? '' : value;
}

async function fetchCoreSettings(): Promise<HostedEmailSettings | null> {
  const response = await carinaGet(`/api/internal/settings/${encodeURIComponent(DOMAIN_ID)}`, 8000);
  const parsed = await carinaJson<HostedEmailSettings>(response);
  return parsed.ok ? parsed.data : null;
}

async function fetchCoreStatus(): Promise<HostedEmailStatus | null> {
  const response = await carinaGet('/api/ops/aiva-hosted-email/status', 8000);
  const parsed = await carinaJson<HostedEmailStatus>(response);
  return parsed.ok ? parsed.data : null;
}

async function loadPageState(): Promise<HostedEmailPageState> {
  if (!carinaOpsTokenSet()) {
    return {
      enabled: true,
      domain: 'inbox.hireaiva.co.uk',
      provider: 'cloudflare',
      secretPresent: false,
      cloudflareSecretDisplay: '',
      mailgunSecretDisplay: '',
      lastInboundAt: null,
      unknownRecipientCount: 0,
      acceptedCount: 0,
      inboundUrl: `${appBaseUrl()}/api/aiva/email/inbound/cloudflare`,
      workerDomain: 'inbox.hireaiva.co.uk',
      error: 'Pair Carina in Settings first.',
    };
  }

  try {
    const [settings, status] = await Promise.all([
      fetchCoreSettings(),
      fetchCoreStatus(),
    ]);
    const provider = status?.provider || readField(settings, 'AIVA_HOSTED_EMAIL_PROVIDER') || 'cloudflare';
    const domain = status?.domain || readField(settings, 'AIVA_HOSTED_EMAIL_DOMAIN') || 'inbox.hireaiva.co.uk';
    const secretPresent = Boolean(status?.inboundSecretPresent ?? status?.signingKeyPresent);
    return {
      enabled: status?.enabled ?? readField(settings, 'AIVA_HOSTED_EMAIL_ENABLED') !== 'false',
      domain,
      provider,
      secretPresent,
      cloudflareSecretDisplay: secretPresent && provider === 'cloudflare' ? SECRET_MASK : '',
      mailgunSecretDisplay: secretPresent && provider === 'mailgun' ? SECRET_MASK : '',
      lastInboundAt: status?.lastInboundAt ?? null,
      unknownRecipientCount: status?.unknownRecipientCount ?? 0,
      acceptedCount: status?.acceptedCount ?? 0,
      inboundUrl: `${appBaseUrl()}/api/aiva/email/inbound/${provider === 'mailgun' ? 'mailgun' : 'cloudflare'}`,
      workerDomain: domain,
    };
  } catch (err) {
    return {
      enabled: true,
      domain: 'inbox.hireaiva.co.uk',
      provider: 'cloudflare',
      secretPresent: false,
      cloudflareSecretDisplay: '',
      mailgunSecretDisplay: '',
      lastInboundAt: null,
      unknownRecipientCount: 0,
      acceptedCount: 0,
      inboundUrl: `${appBaseUrl()}/api/aiva/email/inbound/cloudflare`,
      workerDomain: 'inbox.hireaiva.co.uk',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

hostedEmailRouter.get('/', async (req, res) => {
  const state = await loadPageState();
  res.render('hosted-email', {
    title: 'Hosted Aiva email',
    state,
    saved: req.query['saved'] === '1',
    errMsg: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

hostedEmailRouter.post('/save', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect(hostedEmailRedirect({ err: 'Pair Carina in Settings first' }));
    return;
  }

  const body = req.body as Record<string, string | undefined>;
  const enabled = body.enabled === 'on' || body.enabled === 'true';
  const provider = String(body.provider ?? 'cloudflare').trim().toLowerCase();
  const domain = String(body.domain ?? '').trim().toLowerCase();
  const secret = String(body.cloudflareSecret ?? '').trim();
  const mailgunKey = String(body.mailgunSigningKey ?? '').trim();

  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    res.redirect(hostedEmailRedirect({ err: 'Enter a valid inbound email domain' }));
    return;
  }
  if (provider !== 'cloudflare' && provider !== 'mailgun') {
    res.redirect(hostedEmailRedirect({ err: 'Provider must be cloudflare or mailgun' }));
    return;
  }

  const values: Record<string, string> = {
    AIVA_HOSTED_EMAIL_ENABLED: enabled ? 'true' : 'false',
    AIVA_HOSTED_EMAIL_DOMAIN: domain,
    AIVA_HOSTED_EMAIL_PROVIDER: provider,
  };
  if (!isUnchangedSecret(secret)) values.CLOUDFLARE_EMAIL_WORKER_SECRET = secret;
  if (!isUnchangedSecret(mailgunKey)) values.MAILGUN_WEBHOOK_SIGNING_KEY = mailgunKey;

  try {
    const response = await carinaPost(
      `/api/internal/settings/${encodeURIComponent(DOMAIN_ID)}`,
      { values },
      15000,
    );
    const parsed = await carinaJson<{ ok?: boolean; error?: string }>(response);
    if (!parsed.ok) {
      res.redirect(hostedEmailRedirect({ err: parsed.error ?? 'Save failed' }));
      return;
    }
    res.redirect(hostedEmailRedirect({ saved: '1' }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect(hostedEmailRedirect({ err: msg.slice(0, 180) }));
  }
});
