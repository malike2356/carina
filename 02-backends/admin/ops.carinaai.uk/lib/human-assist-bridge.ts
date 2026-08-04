import { carinaGet, carinaPost, carinaOpsTokenSet } from './carina.js';

export type HumanAssistBridgeStatus = {
  enabled: boolean;
  misBaseUrl: string;
  bridgeTokenSet: boolean;
  bridgeTokenHint?: string;
  publishMode: string;
  lastPublishAt?: string;
  lastPublishOk?: boolean;
  lastPublishError?: string;
  misInboxUrl?: string;
  error?: string;
};

export async function fetchHumanAssistBridgeStatus(): Promise<HumanAssistBridgeStatus> {
  const response = await carinaGet('/api/ops/human-assist/bridge');
  if (!response.ok) {
    return {
      enabled: false,
      misBaseUrl: 'https://verlox.uk',
      bridgeTokenSet: false,
      publishMode: 'push_and_poll',
      error: `Core returned HTTP ${response.status}`,
    };
  }
  return (await response.json()) as HumanAssistBridgeStatus;
}

export async function saveHumanAssistBridge(input: {
  enabled: boolean;
  misBaseUrl: string;
  bridgeToken?: string;
  publishMode: string;
}): Promise<{ ok: boolean; error?: string; status?: HumanAssistBridgeStatus }> {
  if (!carinaOpsTokenSet()) {
    return { ok: false, error: 'Pair Carina in Settings first (CARINA_OPS_TOKEN).' };
  }
  const response = await carinaPost('/api/ops/human-assist/bridge', {
    enabled: input.enabled,
    misBaseUrl: input.misBaseUrl,
    bridgeToken: input.bridgeToken || undefined,
    publishMode: input.publishMode,
  });
  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
  }
  const status = (await response.json()) as HumanAssistBridgeStatus;
  return { ok: true, status };
}
