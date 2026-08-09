/**
 * Customer Concierge feature flags and honest provider readiness (Prompt 700).
 * Missing providers report `not_configured`, never fake `ready`.
 */
import { getConciergeProfile } from '../workers/concierge-profile.js';
import { getToolSession } from '../workers/product-tools/sessions.js';
import { isGoogleToolsOAuthConfigured } from '../workers/product-tools/google-tools-oauth.js';
import { isZoomOAuthConfigured } from '../workers/product-tools/zoom-oauth.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  CUSTOMER_CONCIERGE_CONTRACT_VERSION,
  type ConciergeFeatureKey,
  type ConciergeReadinessReport,
  type FeatureReadinessStatus,
  type FeatureStatus,
} from './types.js';

function envFlag(name: string, defaultOn = true): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultOn;
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true;
  return defaultOn;
}

/** Product feature flags (env). Default on so readiness can report not_configured honestly. */
export function conciergeFeatureFlags(): Record<ConciergeFeatureKey, boolean> {
  return {
    publicConcierge: envFlag('AIVA_CONCIERGE_PUBLIC_ENABLED', true),
    zoom: envFlag('AIVA_CONCIERGE_ZOOM_ENABLED', true),
    googleCalendar: envFlag('AIVA_CONCIERGE_GOOGLE_CALENDAR_ENABLED', true),
    microsoftCalendar: envFlag('AIVA_CONCIERGE_MICROSOFT_CALENDAR_ENABLED', true),
    emailDelivery: envFlag('AIVA_CONCIERGE_EMAIL_DELIVERY_ENABLED', true),
    inboundWebhookReconciliation: envFlag('AIVA_CONCIERGE_INBOUND_WEBHOOKS_ENABLED', true),
  };
}

function feature(
  key: ConciergeFeatureKey,
  enabled: boolean,
  status: FeatureReadinessStatus,
  detail: string | null,
): FeatureStatus {
  if (!enabled) {
    return { key, enabled: false, status: 'disabled', detail: 'Feature flag disabled' };
  }
  return { key, enabled: true, status, detail };
}

function hasSessionCredentials(
  session: Awaited<ReturnType<typeof getToolSession>>,
): boolean {
  return Boolean(session && Object.keys(session.credentials).length > 0);
}

function emailDeliveryConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim()
    || process.env.MAILGUN_API_KEY?.trim()
    || process.env.SMTP_URL?.trim()
    || process.env.AIVA_OUTBOUND_EMAIL_PROVIDER?.trim(),
  );
}

function inboundWebhooksConfigured(): boolean {
  // Prompt 704 will add provider receivers. Until then this is honestly not_configured
  // unless an operator explicitly opts in with a shared secret placeholder.
  return Boolean(
    process.env.AIVA_CONCIERGE_ZOOM_WEBHOOK_SECRET?.trim()
    || process.env.AIVA_CONCIERGE_GOOGLE_CALENDAR_WEBHOOK_TOKEN?.trim()
    || process.env.AIVA_CONCIERGE_MICROSOFT_WEBHOOK_SECRET?.trim(),
  );
}

export async function evaluateProviderReadiness(params: {
  workspaceId: string;
  workerId: string;
}): Promise<ConciergeReadinessReport> {
  const flags = conciergeFeatureFlags();
  const profile = await getConciergeProfile(params.workspaceId, params.workerId).catch(() => null);

  const googleSession = await getToolSession(
    params.workspaceId,
    params.workerId,
    'google-calendar',
  ).catch(() => null);
  const zoomSession = await getToolSession(params.workspaceId, params.workerId, 'zoom').catch(
    () => null,
  );
  const microsoftSession = await getToolSession(
    params.workspaceId,
    params.workerId,
    'calendar-microsoft',
  ).catch(() => null);

  const publicStatus: FeatureReadinessStatus = profile?.published
    ? 'ready'
    : profile
      ? 'disconnected'
      : 'not_configured';

  let zoomStatus: FeatureReadinessStatus = 'not_configured';
  let zoomDetail: string | null = 'Zoom OAuth or worker Zoom session missing';
  if (!isZoomOAuthConfigured() && !hasSessionCredentials(zoomSession)) {
    zoomStatus = 'not_configured';
    zoomDetail = 'ZOOM_CLIENT_ID/SECRET not set and no Zoom tool session';
  } else if (hasSessionCredentials(zoomSession)) {
    zoomStatus = 'ready';
    zoomDetail = 'Zoom credentials stored for worker';
  } else if (isZoomOAuthConfigured()) {
    zoomStatus = 'disconnected';
    zoomDetail = 'Zoom OAuth configured on server; worker not connected';
  }

  let googleStatus: FeatureReadinessStatus = 'not_configured';
  let googleDetail: string | null = 'Google Calendar OAuth session missing';
  if (!isGoogleToolsOAuthConfigured() && !hasSessionCredentials(googleSession)) {
    googleStatus = 'not_configured';
    googleDetail = 'Google OAuth not configured and no google-calendar session';
  } else if (hasSessionCredentials(googleSession)) {
    googleStatus = 'ready';
    googleDetail = 'Google Calendar session present';
  } else if (isGoogleToolsOAuthConfigured()) {
    googleStatus = 'disconnected';
    googleDetail = 'Google OAuth configured; worker calendar not connected';
  }

  // Microsoft calendar driver is not live (catalog coming_soon). Always honest.
  let microsoftStatus: FeatureReadinessStatus = 'not_configured';
  let microsoftDetail: string | null =
    'Microsoft Calendar Graph driver not implemented (catalog coming_soon)';
  if (hasSessionCredentials(microsoftSession)) {
    microsoftStatus = 'disconnected';
    microsoftDetail =
      'Credentials present but Microsoft Calendar write driver is not live';
  }

  const emailStatus: FeatureReadinessStatus = emailDeliveryConfigured()
    ? 'ready'
    : 'not_configured';
  const webhookStatus: FeatureReadinessStatus = inboundWebhooksConfigured()
    ? 'ready'
    : 'not_configured';

  if (!credentialsConfigured()) {
    // Credential store missing: connected providers cannot be trusted.
    if (zoomStatus === 'ready') {
      zoomStatus = 'error';
      zoomDetail = 'CHANNEL_CREDENTIAL_KEY not configured';
    }
    if (googleStatus === 'ready') {
      googleStatus = 'error';
      googleDetail = 'CHANNEL_CREDENTIAL_KEY not configured';
    }
  }

  const features: ConciergeReadinessReport['features'] = {
    publicConcierge: feature(
      'publicConcierge',
      flags.publicConcierge,
      publicStatus,
      publicStatus === 'ready'
        ? 'Published concierge profile'
        : publicStatus === 'disconnected'
          ? 'Concierge profile exists but is unpublished'
          : 'No concierge profile',
    ),
    zoom: feature('zoom', flags.zoom, zoomStatus, zoomDetail),
    googleCalendar: feature(
      'googleCalendar',
      flags.googleCalendar,
      googleStatus,
      googleDetail,
    ),
    microsoftCalendar: feature(
      'microsoftCalendar',
      flags.microsoftCalendar,
      microsoftStatus,
      microsoftDetail,
    ),
    emailDelivery: feature(
      'emailDelivery',
      flags.emailDelivery,
      emailStatus,
      emailStatus === 'ready'
        ? 'Outbound email provider configured'
        : 'RESEND_API_KEY / MAILGUN_API_KEY / SMTP_URL missing',
    ),
    inboundWebhookReconciliation: feature(
      'inboundWebhookReconciliation',
      flags.inboundWebhookReconciliation,
      webhookStatus,
      webhookStatus === 'ready'
        ? 'Inbound webhook secrets configured'
        : 'Provider inbound webhook receivers not configured',
    ),
  };

  const blockers = Object.values(features)
    .filter((f) => f.enabled && f.status !== 'ready')
    .map((f) => f.key);

  return {
    contractVersion: CUSTOMER_CONCIERGE_CONTRACT_VERSION,
    workspaceId: params.workspaceId,
    conciergeId: profile?.id ?? null,
    ready: blockers.length === 0,
    features,
    blockers,
  };
}
