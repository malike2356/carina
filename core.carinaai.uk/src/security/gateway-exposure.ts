import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { getChannelStatusReports } from '../gateway/channels/channel-status.js';
import { channelDmPairingEnabled } from '../gateway/channels/dm-pairing.js';
import { approvalPolicyEnabled } from './approval-policy.js';
import type { SecurityDoctorCheck } from './security-doctor.js';

const UNTRUSTED_MESSENGER_CHANNELS = new Set<ChannelName>([
  'telegram',
  'discord',
  'slack',
  'whatsapp',
  'signal',
  'matrix',
  'mattermost',
  'imessage',
  'sms',
  'irc',
  'teams',
]);

export function resolveGatewayBindHost(explicitHost?: string): string {
  const raw = explicitHost ?? process.env.CARINA_BIND ?? process.env.WEB_HOST ?? '';
  return raw.trim();
}

export function isPublicBindHost(host: string): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase();
  if (normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1') return false;
  return normalized === '0.0.0.0' || normalized === '::' || normalized === '[::]';
}

export function hasWebAuthConfigured(): boolean {
  const password = process.env.CARINA_WEB_PASSWORD?.trim() ?? '';
  const opsToken = process.env.CARINA_OPS_TOKEN?.trim() ?? '';
  return password.length >= 8 || opsToken.length >= 16;
}

export function listConfiguredMessengerChannels(): ChannelName[] {
  return getChannelStatusReports()
    .filter((report) =>
      UNTRUSTED_MESSENGER_CHANNELS.has(report.channel)
      && report.state !== 'disabled')
    .map((report) => report.channel);
}

export function untrustedInboundGuardEnabled(): boolean {
  return channelDmPairingEnabled() || approvalPolicyEnabled();
}

export function recommendedChannelSecurityEnvLines(): string[] {
  return [
    'CARINA_CHANNEL_DM_PAIRING=true',
    'CARINA_APPROVAL_POLICY=on',
    'CARINA_EXEC_APPROVAL_LEVEL=on-miss',
  ];
}

export function collectGatewayExposureChecks(bindHost?: string): SecurityDoctorCheck[] {
  const checks: SecurityDoctorCheck[] = [];
  const host = resolveGatewayBindHost(bindHost);
  const publicBind = isPublicBindHost(host);
  const webAuth = hasWebAuthConfigured();
  const messengers = listConfiguredMessengerChannels();
  const dmOn = channelDmPairingEnabled();
  const approvalOn = approvalPolicyEnabled();

  checks.push({
    id: 'gateway-bind',
    name: 'Gateway bind address',
    severity: publicBind && !webAuth ? 'fail' : publicBind ? 'warn' : 'ok',
    detail: host
      ? `CARINA_BIND=${host}`
      : 'default listen (all interfaces when host unset in Node)',
  });

  if (publicBind && !webAuth) {
    checks[checks.length - 1]!.detail += '; public bind without CARINA_WEB_PASSWORD or CARINA_OPS_TOKEN';
  } else if (publicBind) {
    checks[checks.length - 1]!.detail += '; public bind with auth configured';
  }

  checks.push({
    id: 'channel-dm-pairing',
    name: 'Channel DM pairing',
    severity: messengers.length > 0 && !dmOn ? 'fail' : dmOn ? 'ok' : 'warn',
    detail: dmOn
      ? 'enabled (unknown direct peers require carina channels dm approve)'
      : messengers.length > 0
        ? `disabled while messenger channels are configured: ${messengers.join(', ')}`
        : 'disabled; enable CARINA_CHANNEL_DM_PAIRING=true before connecting messengers',
  });

  checks.push({
    id: 'approval-policy-active',
    name: 'Approval policy for tools',
    severity: approvalOn ? 'ok' : messengers.length > 0 ? 'warn' : 'warn',
    detail: approvalOn
      ? 'enabled (CARINA_APPROVAL_POLICY not off)'
      : 'disabled; dangerous tools may run without explicit approval rules',
  });

  const promptGuardOff = process.env.CARINA_PROMPT_GUARD === 'false';
  checks.push({
    id: 'prompt-guard-messenger',
    name: 'Prompt guard with messengers',
    severity: messengers.length > 0 && promptGuardOff ? 'fail' : promptGuardOff ? 'warn' : 'ok',
    detail: promptGuardOff
      ? 'CARINA_PROMPT_GUARD=false'
      : 'enabled by default',
  });

  return checks;
}

export function formatGatewayExposureWarning(bindHost?: string): string | null {
  const host = resolveGatewayBindHost(bindHost);
  const publicBind = isPublicBindHost(host);
  const messengers = listConfiguredMessengerChannels();

  if (publicBind && !hasWebAuthConfigured()) {
    return 'WARNING: Gateway is reachable beyond localhost without CARINA_WEB_PASSWORD or CARINA_OPS_TOKEN. See docs/gateways/remote-access.md';
  }

  if (messengers.length > 0 && !channelDmPairingEnabled()) {
    return `WARNING: Messenger channels configured (${messengers.join(', ')}) but CARINA_CHANNEL_DM_PAIRING is not true. Unknown DMs can reach the agent. Run: carina security doctor`;
  }

  return null;
}
