import { writeSetting, readDomainSettings } from '../config/settings-store.js';

const DOMAIN = 'integration:aiva-human-assist-bridge';

export type HumanAssistBridgeConfig = {
  enabled: boolean;
  misBaseUrl: string;
  bridgeToken: string;
  publishMode: 'push_and_poll' | 'poll_only' | 'push_only';
  lastPublishAt?: string;
  lastPublishOk?: boolean;
  lastPublishError?: string;
};

function liveToken(): string {
  return (
    process.env.AIVA_HUMAN_ASSIST_BRIDGE_TOKEN?.trim()
    || process.env.CARINA_OPS_TOKEN?.trim()
    || ''
  );
}

function liveMisUrl(): string {
  return (
    process.env.AIVA_HUMAN_ASSIST_MIS_URL?.trim()
    || process.env.VERLOX_MIS_URL?.trim()
    || 'https://verlox.uk'
  ).replace(/\/$/, '');
}

export function isHumanAssistBridgeEnabled(): boolean {
  const raw = process.env.AIVA_HUMAN_ASSIST_BRIDGE_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  // Default on when token present so MIS can poll; GUI can disable.
  return Boolean(liveToken());
}

export async function getHumanAssistBridgeConfig(): Promise<HumanAssistBridgeConfig> {
  const saved = await readDomainSettings(DOMAIN, null).catch(() => ({} as Record<string, string>));
  const enabledRaw = saved.AIVA_HUMAN_ASSIST_BRIDGE_ENABLED;
  let enabled = isHumanAssistBridgeEnabled();
  if (enabledRaw === '0' || enabledRaw === 'false') enabled = false;
  if (enabledRaw === '1' || enabledRaw === 'true') enabled = true;

  const misBaseUrl = (saved.AIVA_HUMAN_ASSIST_MIS_URL || liveMisUrl()).replace(/\/$/, '');
  const bridgeToken = saved.AIVA_HUMAN_ASSIST_BRIDGE_TOKEN || liveToken();
  const publishMode = (saved.AIVA_HUMAN_ASSIST_PUBLISH_MODE as HumanAssistBridgeConfig['publishMode'])
    || (process.env.AIVA_HUMAN_ASSIST_PUBLISH_MODE as HumanAssistBridgeConfig['publishMode'])
    || 'push_and_poll';

  if (bridgeToken && !process.env.AIVA_HUMAN_ASSIST_BRIDGE_TOKEN) {
    process.env.AIVA_HUMAN_ASSIST_BRIDGE_TOKEN = bridgeToken;
  }
  if (misBaseUrl) process.env.AIVA_HUMAN_ASSIST_MIS_URL = misBaseUrl;

  return {
    enabled,
    misBaseUrl,
    bridgeToken,
    publishMode,
    lastPublishAt: saved.LAST_PUBLISH_AT || undefined,
    lastPublishOk: saved.LAST_PUBLISH_OK === '1' ? true : saved.LAST_PUBLISH_OK === '0' ? false : undefined,
    lastPublishError: saved.LAST_PUBLISH_ERROR || undefined,
  };
}

export async function saveHumanAssistBridgeConfig(input: {
  enabled?: boolean;
  misBaseUrl?: string;
  bridgeToken?: string;
  publishMode?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const writes = [];
  if (input.enabled !== undefined) {
    writes.push(writeSetting({
      domainId: DOMAIN,
      key: 'AIVA_HUMAN_ASSIST_BRIDGE_ENABLED',
      value: input.enabled ? '1' : '0',
      sensitive: false,
      envVar: 'AIVA_HUMAN_ASSIST_BRIDGE_ENABLED',
      workspaceId: null,
    }));
  }
  if (input.misBaseUrl !== undefined) {
    const url = input.misBaseUrl.trim().replace(/\/$/, '') || 'https://verlox.uk';
    writes.push(writeSetting({
      domainId: DOMAIN,
      key: 'AIVA_HUMAN_ASSIST_MIS_URL',
      value: url,
      sensitive: false,
      envVar: 'AIVA_HUMAN_ASSIST_MIS_URL',
      workspaceId: null,
    }));
    process.env.AIVA_HUMAN_ASSIST_MIS_URL = url;
  }
  if (input.bridgeToken !== undefined && input.bridgeToken.trim()) {
    const token = input.bridgeToken.trim();
    writes.push(writeSetting({
      domainId: DOMAIN,
      key: 'AIVA_HUMAN_ASSIST_BRIDGE_TOKEN',
      value: token,
      sensitive: true,
      envVar: 'AIVA_HUMAN_ASSIST_BRIDGE_TOKEN',
      workspaceId: null,
    }));
    process.env.AIVA_HUMAN_ASSIST_BRIDGE_TOKEN = token;
  }
  if (input.publishMode) {
    const mode = ['push_and_poll', 'poll_only', 'push_only'].includes(input.publishMode)
      ? input.publishMode
      : 'push_and_poll';
    writes.push(writeSetting({
      domainId: DOMAIN,
      key: 'AIVA_HUMAN_ASSIST_PUBLISH_MODE',
      value: mode,
      sensitive: false,
      envVar: 'AIVA_HUMAN_ASSIST_PUBLISH_MODE',
      workspaceId: null,
    }));
  }
  const results = await Promise.all(writes);
  for (const r of results) {
    if (!r.ok && r.error?.includes('DATABASE_URL is not configured')) continue;
    if (!r.ok) return { ok: false, error: r.error ?? 'save failed' };
  }
  return { ok: true };
}

export async function recordHumanAssistPublishResult(input: {
  ok: boolean;
  error?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    writeSetting({
      domainId: DOMAIN,
      key: 'LAST_PUBLISH_AT',
      value: now,
      sensitive: false,
      workspaceId: null,
    }),
    writeSetting({
      domainId: DOMAIN,
      key: 'LAST_PUBLISH_OK',
      value: input.ok ? '1' : '0',
      sensitive: false,
      workspaceId: null,
    }),
    writeSetting({
      domainId: DOMAIN,
      key: 'LAST_PUBLISH_ERROR',
      value: input.ok ? '' : (input.error ?? 'unknown').slice(0, 400),
      sensitive: false,
      workspaceId: null,
    }),
  ]);
}

export function bridgeTokenHint(token: string): string | undefined {
  if (!token) return undefined;
  if (token.length <= 8) return 'set';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}
