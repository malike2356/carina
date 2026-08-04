/**
 * Unified `configure` tool.
 *
 * Single entry point for all Carina configuration via conversation.
 * Dispatches to channel_config (Wave 1) or the settings registry (all other domains).
 * Never tells the user to find a settings page.
 */

import {
  findDomainByAlias,
  listDomainSummaries,
  getDomainRequiredFields,
  ALL_CONFIG_DOMAINS,
  DOMAIN_CATEGORY_LABELS,
  type ConfigDomain,
} from '../config/settings-requirements.js';
import {
  readDomainSettings,
  saveDomainSettings,
  isDomainConfigured,
  deleteSetting,
} from '../config/settings-store.js';
import {
  findChannelByAlias,
  listChannelSummaries,
  CHANNEL_REQUIREMENTS,
  getRequiredFields as getChannelRequiredFields,
} from '../channels/channel-requirements.js';
import {
  getConfiguredChannels,
  saveChannelConfiguration,
  removeChannelConfiguration,
  testChannelConfiguration,
} from '../api/channel-config-api.js';
import {
  createPairingToken,
  listPairDevicesForApi,
  revokePairDevice,
} from '../pairing/pairing.js';
import { createPairingCode, listPairedDevices } from '../infrastructure/device-pairing.js';
import {
  createSubscription,
  disableSubscription,
  listSubscriptions,
  subscriptionPayload,
  WEBHOOK_EVENTS,
  type WebhookEvent,
} from '../webhooks/store.js';
import {
  buildGoogleWorkspaceAuthUrl,
  exchangeGoogleWorkspaceCode,
} from '../integrations/google-workspace-oauth.js';

function resolveWorkspaceId(): string | null {
  return process.env.CARINA_WORKSPACE_ID?.trim() || null;
}

function groupDomainsByCategory(
  domains: Array<{ id: string; name: string; category: string; configured?: boolean }>,
) {
  const groups: Record<string, typeof domains> = {};
  for (const d of domains) {
    const cat = d.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(d);
  }
  return groups;
}

export const configureTool = {
  name: 'configure',
  description: `Configure any aspect of Carina by conversation.
Handles ALL configurable domains: messaging channels, LLM provider keys, default model,
workspace preferences (timezone, language, quiet hours), search providers, Scout security
monitoring, integrations (n8n, Trello, CalDAV, Google Workspace, Resend, Notion, outbound webhooks), mobile companion pairing,
and voice/TTS settings.

Actions:
- list: show what is configured and what needs to be set up
- set: save one or more settings for a domain (prompts one field at a time if values missing)
- get: read current values for a domain (redacts sensitive fields)
- test: verify a connection or credential is working
- remove: delete saved configuration for a domain

Use this tool whenever the user wants to configure, set up, change, check, or remove
ANY setting or integration. Never tell the user to navigate to a settings page.

Examples of what this handles:
- "Add my OpenAI key" -> configure provider:openai
- "Set my timezone to London" -> configure workspace:timezone
- "Configure Telegram" -> configure channel:telegram
- "Use DeepSeek as my default model" -> configure model:default
- "Enable quiet hours from 10pm" -> configure workspace:quiet-hours
- "Connect my n8n" -> configure integration:n8n
- "Connect Notion" -> configure integration:notion
- "Connect Companies House" -> configure integration:companies-house
- "Connect Google Workspace" -> configure integration:google-workspace
- "Add an outbound webhook" -> configure integration:webhooks
- "Pair my phone" / "pair companion" -> configure device:companion
- "Turn on Scout monitoring" -> configure scout:enabled
- "Change TTS voice" -> configure voice:tts`,

  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'set', 'get', 'test', 'remove'],
        description: 'What to do',
      },
      target: {
        type: 'string',
        description: `What to configure. Can be a domain id or alias.
Examples: "openai", "telegram", "timezone", "default model", "n8n", "scout", "tts".
Leave blank for action=list to see all domains.`,
      },
      values: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Key-value pairs of settings to save. Use field keys from the domain registry.',
      },
    },
    required: ['action'],
  },

  async execute(params: Record<string, unknown>) {
    const action = String(params.action ?? '');
    const rawTarget = String(params.target ?? '').trim();
    const values = (params.values ?? {}) as Record<string, string>;
    const workspaceId = resolveWorkspaceId();

    // ── LIST ─────────────────────────────────────────────────────────────────

    if (action === 'list') {
      if (!rawTarget) {
        return listAll(workspaceId);
      }
      return getDomainStatus(rawTarget, workspaceId);
    }

    // ── GET ──────────────────────────────────────────────────────────────────

    if (action === 'get') {
      if (!rawTarget) {
        return { error: 'target is required for get. Say which domain to read.' };
      }
      return getDomainStatus(rawTarget, workspaceId);
    }

    // ── SET ──────────────────────────────────────────────────────────────────

    if (action === 'set') {
      if (!rawTarget) {
        return { error: 'target is required for set. Say what you want to configure.' };
      }
      return setDomain(rawTarget, values, workspaceId);
    }

    // ── TEST ─────────────────────────────────────────────────────────────────

    if (action === 'test') {
      if (!rawTarget) {
        return { error: 'target is required for test.' };
      }
      return testDomain(rawTarget, workspaceId);
    }

    // ── REMOVE ───────────────────────────────────────────────────────────────

    if (action === 'remove') {
      if (!rawTarget) {
        return { error: 'target is required for remove.' };
      }
      return removeDomain(rawTarget, workspaceId);
    }

    return { error: `Unknown action: "${action}". Use list, set, get, test, or remove.` };
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function listAll(workspaceId: string | null) {
  const channelSummaries = listChannelSummaries();
  const configuredChannels = await getConfiguredChannels(workspaceId);
  const configuredChannelIds = new Set(configuredChannels.map((c) => c.channelId));

  const channels = channelSummaries.map(({ id, name }) => ({
    id: `channel:${id}`,
    name,
    category: 'channel',
    configured: configuredChannelIds.has(id),
  }));

  const settingDomains = await Promise.all(
    listDomainSummaries().map(async ({ id, name, category }) => {
      let configured = false;
      if (id === 'device:companion') {
        configured = listPairedDevices().length > 0;
      } else {
        configured = await isDomainConfigured(id, workspaceId);
      }
      return { id, name, category, configured };
    }),
  );

  const all = [...channels, ...settingDomains];
  const configured = all.filter((d) => d.configured);
  const unconfigured = all.filter((d) => !d.configured);

  const groups = groupDomainsByCategory(all);
  const categoryRows = Object.entries(groups).map(([cat, items]) => ({
    category: DOMAIN_CATEGORY_LABELS[cat] ?? cat,
    items: items.map(({ id, name, configured: c }) => ({ id, name, configured: c })),
  }));

  return {
    action: 'list',
    summary: `${configured.length} configured, ${unconfigured.length} available`,
    categories: categoryRows,
  };
}

async function getDomainStatus(target: string, workspaceId: string | null) {
  // Channel domains
  const channel = findChannelByAlias(target) ?? CHANNEL_REQUIREMENTS.find((c) => c.id === target) ?? null;
  if (channel || target.startsWith('channel:')) {
    const ch = channel ?? CHANNEL_REQUIREMENTS.find((c) => c.id === target.replace('channel:', ''));
    if (!ch) return { error: `Unknown channel: "${target}"` };

    const configured = (await getConfiguredChannels(workspaceId)).find((c) => c.channelId === ch.id);
    return {
      action: 'get',
      domainId: `channel:${ch.id}`,
      name: ch.name,
      configured: Boolean(configured),
      status: configured?.status ?? 'not_configured',
      requiresRestart: configured?.requiresRestart ?? false,
      testedAt: configured?.testedAt ?? null,
      fields: ch.fields.map((f) => ({
        key: f.key,
        label: f.label,
        sensitive: f.sensitive,
        optional: f.optional,
      })),
    };
  }

  // Settings domains
  const domain = resolveDomain(target);
  if (!domain) {
    return { error: buildNotFoundError(target) };
  }

  if (domain.id === 'device:companion') {
    const devices = listPairDevicesForApi();
    return {
      action: 'get',
      domainId: domain.id,
      name: domain.name,
      configured: devices.length > 0,
      requiresRestart: false,
      devices,
      message:
        devices.length === 0
          ? 'No companion devices paired yet. Say "pair my phone" to start.'
          : `${devices.length} paired device(s).`,
    };
  }

  if (domain.id === 'integration:webhooks') {
    try {
      const subs = await listSubscriptions(true);
      return {
        action: 'get',
        domainId: domain.id,
        name: domain.name,
        configured: subs.length > 0,
        requiresRestart: false,
        subscriptions: subs.map((s) => subscriptionPayload(s)),
        message:
          subs.length === 0
            ? 'No outbound webhooks configured yet.'
            : `${subs.length} webhook subscription(s).`,
      };
    } catch {
      return {
        action: 'get',
        domainId: domain.id,
        name: domain.name,
        configured: false,
        requiresRestart: false,
        subscriptions: [],
        message: 'Webhook store unavailable (database may be offline).',
      };
    }
  }

  const saved = await readDomainSettings(domain.id, workspaceId);
  const isConfigured = Object.keys(saved).length > 0;

  return {
    action: 'get',
    domainId: domain.id,
    name: domain.name,
    configured: isConfigured,
    requiresRestart: domain.requiresRestart ?? false,
    fields: domain.fields.map((f) => ({
      key: f.key,
      label: f.label,
      sensitive: f.sensitive,
      optional: f.optional,
      currentValue: isConfigured
        ? f.sensitive
          ? saved[f.key] !== undefined
            ? '[set]'
            : '[not set]'
          : saved[f.key] ?? process.env[f.envVar ?? ''] ?? '[not set]'
        : '[not set]',
    })),
  };
}

async function setDomain(
  target: string,
  values: Record<string, string>,
  workspaceId: string | null,
) {
  // Channel domains
  const channel = resolveChannelTarget(target);
  if (channel) {
    if (Object.keys(values).length === 0) {
      const required = getChannelRequiredFields(channel.id);
      const optional = channel.fields.filter((f) => f.optional);
      return {
        action: 'set',
        domainId: `channel:${channel.id}`,
        name: channel.name,
        status: 'needs_values',
        requiredFields: required.map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
          sensitive: f.sensitive,
          example: f.example,
        })),
        optionalFields: optional.map((f) => ({
          key: f.key,
          label: f.label,
          description: f.description,
          sensitive: f.sensitive,
          example: f.example,
        })),
        message: `To configure ${channel.name}, I need the required fields.`,
        setupDocs: channel.setupDocs,
      };
    }

    const missingRequired = channel.fields
      .filter((f) => !f.optional && !values[f.key]?.trim())
      .map((f) => ({ key: f.key, label: f.label, sensitive: f.sensitive }));

    if (missingRequired.length > 0) {
      return {
        action: 'set',
        domainId: `channel:${channel.id}`,
        name: channel.name,
        status: 'missing_fields',
        missingFields: missingRequired,
        message: `Still need: ${missingRequired.map((f) => f.label).join(', ')}`,
      };
    }

    const result = await saveChannelConfiguration(channel, values, workspaceId);
    return {
      action: 'set',
      domainId: `channel:${channel.id}`,
      name: channel.name,
      success: result.ok,
      requiresRestart: result.requiresRestart,
      error: result.error,
      message: result.ok
        ? result.requiresRestart
          ? `${channel.name} configured. Restart Carina to activate.`
          : `${channel.name} configured and active.`
        : `Failed to save: ${result.error}`,
    };
  }

  // Settings domains
  const domain = resolveDomain(target);
  if (!domain) {
    return { error: buildNotFoundError(target) };
  }

  if (domain.id === 'device:companion') {
    return handleCompanionSet(values);
  }

  if (domain.id === 'integration:webhooks') {
    return handleWebhooksSet(values);
  }

  if (domain.id === 'integration:google-workspace') {
    return handleGoogleWorkspaceSet(values, workspaceId);
  }

  if (Object.keys(values).length === 0) {
    const required = getDomainRequiredFields(domain.id);
    const optional = domain.fields.filter((f) => f.optional);
    return {
      action: 'set',
      domainId: domain.id,
      name: domain.name,
      status: 'needs_values',
      requiredFields: required.map((f) => ({
        key: f.key,
        label: f.label,
        description: f.description,
        sensitive: f.sensitive,
        example: f.example,
        validValues: f.validValues,
      })),
      optionalFields: optional.map((f) => ({
        key: f.key,
        label: f.label,
        description: f.description,
        sensitive: f.sensitive,
        example: f.example,
        validValues: f.validValues,
      })),
      message: `To configure ${domain.name}, I need the required fields.`,
      setupDocs: domain.setupDocs,
    };
  }

  const missing = domain.fields
    .filter((f) => !f.optional && !values[f.key]?.trim())
    .map((f) => ({ key: f.key, label: f.label, sensitive: f.sensitive }));

  if (missing.length > 0) {
    return {
      action: 'set',
      domainId: domain.id,
      name: domain.name,
      status: 'missing_fields',
      missingFields: missing,
      message: `Still need: ${missing.map((f) => f.label).join(', ')}`,
    };
  }

  const result = await saveDomainSettings(domain, values, workspaceId);
  if (!result.ok) {
    return {
      action: 'set',
      domainId: domain.id,
      name: domain.name,
      success: false,
      error: result.error,
    };
  }

  return {
    action: 'set',
    domainId: domain.id,
    name: domain.name,
    success: true,
    requiresRestart: domain.requiresRestart ?? false,
    message: domain.requiresRestart
      ? `${domain.name} saved. Restart Carina for the change to take full effect.`
      : `${domain.name} saved and active.`,
  };
}

async function testDomain(target: string, workspaceId: string | null) {
  const channel = resolveChannelTarget(target);
  if (channel) {
    const result = await testChannelConfiguration(channel.id, workspaceId);
    return { action: 'test', domainId: `channel:${channel.id}`, name: channel.name, ...result };
  }

  const domain = resolveDomain(target);
  if (!domain) {
    return { error: buildNotFoundError(target) };
  }

  switch (domain.id) {
    case 'provider:openai':     return testOpenAi(workspaceId);
    case 'provider:anthropic':  return testAnthropic(workspaceId);
    case 'provider:deepseek':   return testDeepSeek(workspaceId);
    case 'provider:gemini':     return testGemini(workspaceId);
    case 'provider:groq':       return testGroq(workspaceId);
    case 'provider:mistral':    return testMistral(workspaceId);
    case 'provider:ollama':     return testOllama(workspaceId);
    case 'provider:tavily':     return testTavily(workspaceId);
    case 'integration:n8n':     return testN8n(workspaceId);
    case 'integration:trello':  return testTrello(workspaceId);
    case 'integration:caldav':  return testCalDav(workspaceId);
    case 'integration:resend':  return testResend(workspaceId);
    case 'integration:notion':  return testNotion(workspaceId);
    case 'integration:companies-house': return testCompaniesHouse(workspaceId);
    case 'integration:google-workspace': return testGoogleWorkspace(workspaceId);
    case 'integration:webhooks': {
      try {
        const subs = await listSubscriptions(true);
        return {
          action: 'test',
          domainId: domain.id,
          name: domain.name,
          success: true,
          message:
            subs.length === 0
              ? 'Webhook system ready. No subscriptions yet.'
              : `${subs.filter((s) => s.active).length} active webhook(s) of ${subs.length} total.`,
          subscriptions: subs.map((s) => subscriptionPayload(s)),
        };
      } catch {
        return {
          action: 'test',
          domainId: domain.id,
          name: domain.name,
          success: false,
          message: 'Webhook store unavailable (database may be offline).',
        };
      }
    }
    case 'device:companion': {
      const devices = listPairDevicesForApi();
      return {
        action: 'test',
        domainId: domain.id,
        name: domain.name,
        success: true,
        message:
          devices.length === 0
            ? 'Companion pairing is available. No devices paired yet.'
            : `${devices.length} companion device(s) paired.`,
        devices,
      };
    }
    case 'scout:endpoint':      return testScout(workspaceId);
    case 'search:searxng':      return testSearXng(workspaceId);
    default:
      return {
        action: 'test',
        domainId: domain.id,
        name: domain.name,
        success: true,
        message: `${domain.name} settings saved. No live connectivity test available for this domain.`,
      };
  }
}

async function removeDomain(target: string, workspaceId: string | null) {
  const channel = resolveChannelTarget(target);
  if (channel) {
    const result = await removeChannelConfiguration(channel.id, workspaceId);
    return {
      action: 'remove',
      domainId: `channel:${channel.id}`,
      name: channel.name,
      success: result.ok,
      message: result.ok ? `${channel.name} configuration removed.` : 'Could not remove.',
    };
  }

  const domain = resolveDomain(target);
  if (!domain) {
    return { error: buildNotFoundError(target) };
  }

  if (domain.id === 'device:companion') {
    const devices = listPairDevicesForApi();
    if (devices.length === 0) {
      return {
        action: 'remove',
        domainId: domain.id,
        name: domain.name,
        success: true,
        message: 'No companion devices to remove.',
      };
    }
    return {
      action: 'remove',
      domainId: domain.id,
      name: domain.name,
      success: false,
      status: 'needs_device_id',
      devices,
      message:
        'Pass values.device_id to revoke a specific companion device, or use set with action=remove.',
    };
  }

  if (domain.id === 'integration:webhooks') {
    try {
      const subs = await listSubscriptions(true);
      if (subs.length === 0) {
        return {
          action: 'remove',
          domainId: domain.id,
          name: domain.name,
          success: true,
          message: 'No webhook subscriptions to remove.',
        };
      }
      return {
        action: 'remove',
        domainId: domain.id,
        name: domain.name,
        success: false,
        status: 'needs_subscription_id',
        subscriptions: subs.map((s) => subscriptionPayload(s)),
        message:
          'Pass values.subscription_id (or use set with action=remove) to disable a webhook.',
      };
    } catch {
      return {
        action: 'remove',
        domainId: domain.id,
        name: domain.name,
        success: false,
        message: 'Webhook store unavailable (database may be offline).',
      };
    }
  }

  for (const field of domain.fields) {
    await deleteSetting(field.key, workspaceId);
  }

  return {
    action: 'remove',
    domainId: domain.id,
    name: domain.name,
    success: true,
    message: `${domain.name} configuration removed.`,
  };
}

function handleCompanionSet(values: Record<string, string>) {
  const action = (values.action || 'create').trim().toLowerCase();

  if (action === 'list') {
    const devices = listPairDevicesForApi();
    return {
      action: 'set',
      domainId: 'device:companion',
      name: 'Mobile companion pairing',
      success: true,
      devices,
      message:
        devices.length === 0
          ? 'No companion devices paired.'
          : `${devices.length} paired device(s).`,
    };
  }

  if (action === 'remove') {
    const deviceId = (values.device_id || '').trim();
    if (!deviceId) {
      return {
        action: 'set',
        domainId: 'device:companion',
        name: 'Mobile companion pairing',
        status: 'missing_fields',
        missingFields: [{ key: 'device_id', label: 'Device id', sensitive: false }],
        devices: listPairDevicesForApi(),
        message: 'Need device_id to revoke a companion device.',
      };
    }
    const ok = revokePairDevice(deviceId);
    return {
      action: 'set',
      domainId: 'device:companion',
      name: 'Mobile companion pairing',
      success: ok,
      message: ok
        ? `Companion device ${deviceId} revoked.`
        : `No companion device found with id ${deviceId}.`,
    };
  }

  // Default: create (also when values is empty; conversation starts pairing immediately)
  const session = createPairingToken();
  const code = createPairingCode();
  return {
    action: 'set',
    domainId: 'device:companion',
    name: 'Mobile companion pairing',
    success: true,
    status: 'pairing_started',
    shortCode: code.code,
    expiresAt: session.expiresAt,
    codeExpiresAt: code.expiresAt,
    uri: session.uri,
    deepLink: `carina://pair?token=${encodeURIComponent(session.token)}`,
    message:
      `Pairing started. Short code: ${code.code} (valid ~15 min). ` +
      `On Carina Mobile, scan the QR or open the pair link. ` +
      `Do not read the full token aloud on voice channels.`,
    // Token included for QR/deep-link UIs; skill must not echo it on voice.
    token: session.token,
  };
}

async function webhooksConfigured(): Promise<boolean> {
  try {
    const subs = await listSubscriptions(true);
    return subs.length > 0;
  } catch {
    return false;
  }
}

function parseWebhookEvents(raw: string | undefined): WebhookEvent[] {
  if (!raw?.trim()) return [...WEBHOOK_EVENTS];
  const allowed = new Set<string>(WEBHOOK_EVENTS);
  const parsed = raw
    .split(',')
    .map((e) => e.trim())
    .filter((e): e is WebhookEvent => allowed.has(e));
  return parsed.length > 0 ? parsed : [...WEBHOOK_EVENTS];
}

async function handleWebhooksSet(values: Record<string, string>) {
  const action = (values.action || (values.url?.trim() ? 'create' : '')).trim().toLowerCase();

  if (action === 'list') {
    try {
      const subs = await listSubscriptions(true);
      return {
        action: 'set',
        domainId: 'integration:webhooks',
        name: 'Outbound webhooks',
        success: true,
        subscriptions: subs.map((s) => subscriptionPayload(s)),
        message:
          subs.length === 0
            ? 'No outbound webhooks configured.'
            : `${subs.length} webhook subscription(s).`,
      };
    } catch {
      return {
        action: 'set',
        domainId: 'integration:webhooks',
        name: 'Outbound webhooks',
        success: false,
        message: 'Webhook store unavailable (database may be offline).',
      };
    }
  }

  if (action === 'remove') {
    const subscriptionId = (values.subscription_id || '').trim();
    if (!subscriptionId) {
      let subscriptions: Record<string, unknown>[] = [];
      try {
        subscriptions = (await listSubscriptions(true)).map((s) => subscriptionPayload(s));
      } catch {
        // ignore
      }
      return {
        action: 'set',
        domainId: 'integration:webhooks',
        name: 'Outbound webhooks',
        status: 'missing_fields',
        missingFields: [{ key: 'subscription_id', label: 'Subscription id', sensitive: false }],
        subscriptions,
        message: 'Need subscription_id to disable a webhook.',
      };
    }
    try {
      const ok = await disableSubscription(subscriptionId);
      return {
        action: 'set',
        domainId: 'integration:webhooks',
        name: 'Outbound webhooks',
        success: ok,
        message: ok
          ? `Webhook ${subscriptionId} disabled.`
          : `No active webhook found with id ${subscriptionId}.`,
      };
    } catch {
      return {
        action: 'set',
        domainId: 'integration:webhooks',
        name: 'Outbound webhooks',
        success: false,
        message: 'Webhook store unavailable (database may be offline).',
      };
    }
  }

  const url = (values.url || '').trim();
  if (!url) {
    return {
      action: 'set',
      domainId: 'integration:webhooks',
      name: 'Outbound webhooks',
      status: 'needs_values',
      requiredFields: [
        {
          key: 'url',
          label: 'Webhook URL',
          description: 'HTTPS endpoint that receives signed events',
          sensitive: false,
          example: 'https://example.com/hooks/carina',
        },
      ],
      optionalFields: [
        {
          key: 'events',
          label: 'Events',
          description: `Comma-separated; default all. Options: ${WEBHOOK_EVENTS.join(', ')}`,
          sensitive: false,
          example: 'agent.turn.complete',
        },
        {
          key: 'name',
          label: 'Name',
          description: 'Optional label for this subscription',
          sensitive: false,
          example: 'ops-alerts',
        },
      ],
      message: 'To add an outbound webhook, I need the HTTPS URL.',
    };
  }

  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    return {
      action: 'set',
      domainId: 'integration:webhooks',
      name: 'Outbound webhooks',
      success: false,
      error: 'url must use HTTPS (or http://localhost for dev)',
    };
  }

  try {
    const events = parseWebhookEvents(values.events);
    const sub = await createSubscription(url, events, {
      name: values.name?.trim() || undefined,
    });
    return {
      action: 'set',
      domainId: 'integration:webhooks',
      name: 'Outbound webhooks',
      success: true,
      status: 'created',
      subscription: subscriptionPayload(sub, true),
      message:
        'Webhook created. Store the signing secret now; it will not be shown again. ' +
        'Verify X-Carina-Signature on received payloads. Never speak the secret aloud.',
    };
  } catch (err) {
    return {
      action: 'set',
      domainId: 'integration:webhooks',
      name: 'Outbound webhooks',
      success: false,
      error: err instanceof Error ? err.message : String(err),
      message: 'Could not create webhook subscription.',
    };
  }
}

async function handleGoogleWorkspaceSet(
  values: Record<string, string>,
  workspaceId: string | null,
) {
  const domain = ALL_CONFIG_DOMAINS.find((d) => d.id === 'integration:google-workspace');
  if (!domain) {
    return { error: 'Google Workspace domain missing from registry.' };
  }

  const saved = await readDomainSettings(domain.id, workspaceId);
  const clientId =
    values.GOOGLE_CLIENT_ID?.trim() ||
    saved.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    '';
  const clientSecret =
    values.GOOGLE_CLIENT_SECRET?.trim() ||
    saved.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    '';
  const refreshToken =
    values.GOOGLE_REFRESH_TOKEN?.trim() ||
    saved.GOOGLE_REFRESH_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN?.trim() ||
    '';
  const oauthCode = values.oauth_code?.trim() || '';
  const redirectUri = values.redirect_uri?.trim() || undefined;

  if (!clientId || !clientSecret) {
    const platformReady = Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim()
      && process.env.GOOGLE_CLIENT_SECRET?.trim(),
    );
    return {
      action: 'set',
      domainId: domain.id,
      name: domain.name,
      status: 'needs_values',
      requiredFields: platformReady
        ? []
        : [
            {
              key: 'GOOGLE_CLIENT_ID',
              label: 'Google OAuth client id',
              description: 'Company Verlox platform Client ID (Ops) or workspace BYOK Client ID',
              sensitive: false,
              example: '123456789-abc.apps.googleusercontent.com',
            },
            {
              key: 'GOOGLE_CLIENT_SECRET',
              label: 'Google OAuth client secret',
              description: 'Company platform secret (Ops) or workspace BYOK secret',
              sensitive: true,
            },
          ],
      optionalFields: [
        {
          key: 'GOOGLE_CLIENT_ID',
          label: 'Google OAuth client id (BYOK override)',
          description: 'Only if this workspace must use its own Google Cloud client',
          sensitive: false,
          example: '123456789-abc.apps.googleusercontent.com',
        },
        {
          key: 'GOOGLE_CLIENT_SECRET',
          label: 'Google OAuth client secret (BYOK override)',
          description: 'Workspace BYOK secret paired with the Client ID above',
          sensitive: true,
        },
        {
          key: 'redirect_uri',
          label: 'Redirect URI',
          description: 'Must match the Client ID in use (platform URIs are already on the company Verlox client)',
          sensitive: false,
          example: 'http://localhost:7430/oauth/google/callback',
        },
      ],
      message: platformReady
        ? 'Company Verlox platform Google OAuth is already configured. In the app, click Connect with Google. Only provide Client ID/secret for workspace BYOK.'
        : 'Platform Google OAuth is not loaded. Ops should apply the company Verlox client, or provide BYOK Client ID and secret.',
      setupDocs: domain.setupDocs,
    };
  }

  // Persist client credentials early so restarts keep them
  const credResult = await saveDomainSettings(
    domain,
    {
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_CLIENT_SECRET: clientSecret,
      ...(refreshToken ? { GOOGLE_REFRESH_TOKEN: refreshToken } : {}),
    },
    workspaceId,
  );
  if (!credResult.ok) {
    return {
      action: 'set',
      domainId: domain.id,
      name: domain.name,
      success: false,
      error: credResult.error,
    };
  }

  if (oauthCode) {
    try {
      const tokens = await exchangeGoogleWorkspaceCode({
        code: oauthCode,
        clientId,
        clientSecret,
        redirectUri,
      });
      const save = await saveDomainSettings(
        domain,
        {
          GOOGLE_CLIENT_ID: clientId,
          GOOGLE_CLIENT_SECRET: clientSecret,
          GOOGLE_REFRESH_TOKEN: tokens.refreshToken,
        },
        workspaceId,
      );
      if (!save.ok) {
        return {
          action: 'set',
          domainId: domain.id,
          name: domain.name,
          success: false,
          error: save.error,
        };
      }
      return {
        action: 'set',
        domainId: domain.id,
        name: domain.name,
        success: true,
        configured: true,
        requiresRestart: true,
        accountEmail: tokens.email || undefined,
        message: tokens.email
          ? `Google Workspace connected as ${tokens.email}. Restart Carina for full effect.`
          : 'Google Workspace connected. Restart Carina for full effect.',
      };
    } catch (err) {
      return {
        action: 'set',
        domainId: domain.id,
        name: domain.name,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        message: 'OAuth code exchange failed. Try again or paste a refresh token.',
      };
    }
  }

  if (values.GOOGLE_REFRESH_TOKEN?.trim()) {
    return {
      action: 'set',
      domainId: domain.id,
      name: domain.name,
      success: true,
      configured: true,
      requiresRestart: true,
      message: 'Google Workspace credentials saved. Restart Carina for full effect.',
    };
  }

  if (refreshToken && !oauthCode && Object.keys(values).length === 0) {
    return {
      action: 'set',
      domainId: domain.id,
      name: domain.name,
      success: true,
      configured: true,
      message: 'Google Workspace refresh token is already configured.',
    };
  }

  const { authUrl, redirectUri: usedRedirect } = buildGoogleWorkspaceAuthUrl({
    clientId,
    redirectUri,
  });

  return {
    action: 'set',
    domainId: domain.id,
    name: domain.name,
    success: true,
    configured: false,
    status: 'needs_oauth',
    authUrl,
    redirectUri: usedRedirect,
    nextField: {
      key: 'oauth_code',
      label: 'OAuth code',
      sensitive: true,
      ask:
        'Open the auth_url in a browser, approve access, then send me the code from the redirect URL (?code=...). ' +
        'If you prefer, type rather than speaking the code aloud.',
    },
    message:
      'Open the Google consent URL, then reply with the OAuth code (or paste GOOGLE_REFRESH_TOKEN).',
  };
}

// ─── Provider tests ───────────────────────────────────────────────────────────

async function testOpenAi(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:openai', workspaceId);
  const key = saved['OPENAI_API_KEY'] || process.env.OPENAI_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'provider:openai', success: false, message: 'No OpenAI key configured.' };
  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { action: 'test', domainId: 'provider:openai', success: true, message: 'OpenAI API key is valid.' };
    return { action: 'test', domainId: 'provider:openai', success: false, message: 'OpenAI API rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'provider:openai', success: false, message: 'Could not reach OpenAI API.' };
  }
}

async function testAnthropic(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:anthropic', workspaceId);
  const key = saved['ANTHROPIC_API_KEY'] || process.env.ANTHROPIC_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'provider:anthropic', success: false, message: 'No Anthropic key configured.' };
  try {
    const resp = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { action: 'test', domainId: 'provider:anthropic', success: true, message: 'Anthropic API key is valid.' };
    return { action: 'test', domainId: 'provider:anthropic', success: false, message: 'Anthropic API rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'provider:anthropic', success: false, message: 'Could not reach Anthropic API.' };
  }
}

async function testDeepSeek(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:deepseek', workspaceId);
  const key = saved['DEEPSEEK_API_KEY'] || process.env.DEEPSEEK_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'provider:deepseek', success: false, message: 'No DeepSeek key configured.' };
  try {
    const resp = await fetch('https://api.deepseek.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { action: 'test', domainId: 'provider:deepseek', success: true, message: 'DeepSeek API key is valid.' };
    return { action: 'test', domainId: 'provider:deepseek', success: false, message: 'DeepSeek rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'provider:deepseek', success: false, message: 'Could not reach DeepSeek API.' };
  }
}

async function testGemini(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:gemini', workspaceId);
  const key = saved['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'provider:gemini', success: false, message: 'No Gemini key configured.' };
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { action: 'test', domainId: 'provider:gemini', success: true, message: 'Gemini API key is valid.' };
    return { action: 'test', domainId: 'provider:gemini', success: false, message: 'Gemini rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'provider:gemini', success: false, message: 'Could not reach Gemini API.' };
  }
}

async function testGroq(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:groq', workspaceId);
  const key = saved['GROQ_API_KEY'] || process.env.GROQ_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'provider:groq', success: false, message: 'No Groq key configured.' };
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { action: 'test', domainId: 'provider:groq', success: true, message: 'Groq API key is valid.' };
    return { action: 'test', domainId: 'provider:groq', success: false, message: 'Groq rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'provider:groq', success: false, message: 'Could not reach Groq API.' };
  }
}

async function testMistral(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:mistral', workspaceId);
  const key = saved['MISTRAL_API_KEY'] || process.env.MISTRAL_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'provider:mistral', success: false, message: 'No Mistral key configured.' };
  try {
    const resp = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { action: 'test', domainId: 'provider:mistral', success: true, message: 'Mistral API key is valid.' };
    return { action: 'test', domainId: 'provider:mistral', success: false, message: 'Mistral rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'provider:mistral', success: false, message: 'Could not reach Mistral API.' };
  }
}

async function testOllama(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:ollama', workspaceId);
  const baseUrl = saved['OLLAMA_BASE_URL'] || process.env.OLLAMA_BASE_URL || '';
  if (!baseUrl) return { action: 'test', domainId: 'provider:ollama', success: false, message: 'No Ollama URL configured.' };
  try {
    const resp = await fetch(baseUrl.replace(/\/$/, '') + '/api/tags', { signal: AbortSignal.timeout(6000) });
    if (resp.ok) {
      const data = (await resp.json()) as { models?: unknown[] };
      const count = data?.models?.length ?? 0;
      return { action: 'test', domainId: 'provider:ollama', success: true, message: `Ollama reachable. ${count} model(s) available.` };
    }
    return { action: 'test', domainId: 'provider:ollama', success: false, message: `Ollama at ${baseUrl} returned HTTP ${resp.status}.` };
  } catch {
    return { action: 'test', domainId: 'provider:ollama', success: false, message: `Could not reach Ollama at ${baseUrl}. Is it running?` };
  }
}

async function testTavily(workspaceId: string | null) {
  const saved = await readDomainSettings('provider:tavily', workspaceId);
  const key = saved['TAVILY_API_KEY'] || process.env.TAVILY_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'provider:tavily', success: false, message: 'No Tavily key configured.' };
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'test', max_results: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok || resp.status === 400) return { action: 'test', domainId: 'provider:tavily', success: true, message: 'Tavily API key is valid.' };
    return { action: 'test', domainId: 'provider:tavily', success: false, message: 'Tavily rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'provider:tavily', success: false, message: 'Could not reach Tavily API.' };
  }
}

async function testN8n(workspaceId: string | null) {
  const saved = await readDomainSettings('integration:n8n', workspaceId);
  const baseUrl = saved['N8N_WEBHOOK_URL'] || process.env.N8N_WEBHOOK_URL || '';
  if (!baseUrl) return { action: 'test', domainId: 'integration:n8n', success: false, message: 'No n8n URL configured.' };
  try {
    const resp = await fetch(baseUrl.replace(/\/$/, '') + '/healthz', { signal: AbortSignal.timeout(6000) });
    if (resp.ok) return { action: 'test', domainId: 'integration:n8n', success: true, message: `n8n at ${baseUrl} is reachable.` };
    return { action: 'test', domainId: 'integration:n8n', success: false, message: `n8n returned HTTP ${resp.status}.` };
  } catch {
    return { action: 'test', domainId: 'integration:n8n', success: false, message: `Could not reach n8n at ${baseUrl}. Is it running?` };
  }
}

async function testTrello(workspaceId: string | null) {
  const saved = await readDomainSettings('integration:trello', workspaceId);
  const apiKey = saved['TRELLO_API_KEY'] || process.env.TRELLO_API_KEY || '';
  const token = saved['TRELLO_TOKEN'] || process.env.TRELLO_TOKEN || '';
  if (!apiKey || !token) return { action: 'test', domainId: 'integration:trello', success: false, message: 'Trello API key and token are both required.' };
  try {
    const url = `https://api.trello.com/1/members/me?key=${apiKey}&token=${token}&fields=fullName`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const data = (await resp.json()) as { fullName?: string };
      return { action: 'test', domainId: 'integration:trello', success: true, message: `Trello connected as ${data.fullName ?? 'a member'}.` };
    }
    return { action: 'test', domainId: 'integration:trello', success: false, message: 'Trello rejected the credentials.' };
  } catch {
    return { action: 'test', domainId: 'integration:trello', success: false, message: 'Could not reach Trello API.' };
  }
}

async function testCalDav(workspaceId: string | null) {
  const saved = await readDomainSettings('integration:caldav', workspaceId);
  const url = saved['CALDAV_URL'] || process.env.CALDAV_URL || '';
  const username = saved['CALDAV_USERNAME'] || process.env.CALDAV_USERNAME || '';
  const password = saved['CALDAV_PASSWORD'] || process.env.CALDAV_PASSWORD || '';
  if (!url) return { action: 'test', domainId: 'integration:caldav', success: false, message: 'No CalDAV URL configured.' };
  try {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const resp = await fetch(url, {
      method: 'OPTIONS',
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.status === 401) return { action: 'test', domainId: 'integration:caldav', success: false, message: 'CalDAV server reachable but credentials were rejected.' };
    if (resp.ok) return { action: 'test', domainId: 'integration:caldav', success: true, message: `CalDAV at ${url} is reachable.` };
    return { action: 'test', domainId: 'integration:caldav', success: false, message: `CalDAV returned HTTP ${resp.status}.` };
  } catch {
    return { action: 'test', domainId: 'integration:caldav', success: false, message: `Could not reach CalDAV at ${url}.` };
  }
}

async function testResend(workspaceId: string | null) {
  const saved = await readDomainSettings('integration:resend', workspaceId);
  const key = saved['RESEND_API_KEY'] || process.env.RESEND_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'integration:resend', success: false, message: 'No Resend API key configured.' };
  try {
    const resp = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return { action: 'test', domainId: 'integration:resend', success: true, message: 'Resend API key is valid.' };
    return { action: 'test', domainId: 'integration:resend', success: false, message: 'Resend rejected the key.' };
  } catch {
    return { action: 'test', domainId: 'integration:resend', success: false, message: 'Could not reach Resend API.' };
  }
}

async function testNotion(workspaceId: string | null) {
  const saved = await readDomainSettings('integration:notion', workspaceId);
  const key = saved['NOTION_API_KEY'] || process.env.NOTION_API_KEY || '';
  if (!key) return { action: 'test', domainId: 'integration:notion', success: false, message: 'No Notion API key configured.' };
  try {
    const resp = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': '2022-06-28',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { name?: string; type?: string };
      return {
        action: 'test',
        domainId: 'integration:notion',
        success: true,
        message: `Notion connected as ${data.name ?? data.type ?? 'integration'}.`,
      };
    }
    return { action: 'test', domainId: 'integration:notion', success: false, message: 'Notion rejected the API key.' };
  } catch {
    return { action: 'test', domainId: 'integration:notion', success: false, message: 'Could not reach Notion API.' };
  }
}

async function testCompaniesHouse(workspaceId: string | null) {
  const saved = await readDomainSettings('integration:companies-house', workspaceId);
  const key = saved.COMPANIES_HOUSE_API_KEY || process.env.COMPANIES_HOUSE_API_KEY || '';
  if (!key) {
    return {
      action: 'test',
      domainId: 'integration:companies-house',
      success: false,
      message:
        'No Companies House API key configured. Register an API Key app at '
        + 'https://developer.company-information.service.gov.uk/ then set COMPANIES_HOUSE_API_KEY.',
    };
  }
  try {
    const auth = `Basic ${Buffer.from(`${key}:`, 'utf8').toString('base64')}`;
    const resp = await fetch('https://api.company-information.service.gov.uk/company/00000006', {
      headers: {
        Accept: 'application/json',
        Authorization: auth,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { company_name?: string; company_number?: string };
      return {
        action: 'test',
        domainId: 'integration:companies-house',
        success: true,
        message:
          `Companies House OK (smoke ${data.company_number ?? '00000006'}`
          + `${data.company_name ? `: ${data.company_name}` : ''}).`,
      };
    }
    if (resp.status === 401 || resp.status === 403) {
      return {
        action: 'test',
        domainId: 'integration:companies-house',
        success: false,
        message: 'Companies House rejected the API key.',
      };
    }
    return {
      action: 'test',
      domainId: 'integration:companies-house',
      success: false,
      message: `Companies House probe returned HTTP ${resp.status}.`,
    };
  } catch {
    return {
      action: 'test',
      domainId: 'integration:companies-house',
      success: false,
      message: 'Could not reach Companies House API.',
    };
  }
}

async function testGoogleWorkspace(workspaceId: string | null) {
  const saved = await readDomainSettings('integration:google-workspace', workspaceId);
  const clientId =
    saved.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    '';
  const clientSecret =
    saved.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    '';
  const refreshToken = saved.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN || '';
  if (!clientId || !clientSecret) {
    return {
      action: 'test',
      domainId: 'integration:google-workspace',
      success: false,
      message: 'Google OAuth client id/secret not configured.',
    };
  }
  if (!refreshToken) {
    return {
      action: 'test',
      domainId: 'integration:google-workspace',
      success: false,
      message: 'Google refresh token not configured. Run configure set google-workspace to finish OAuth.',
    };
  }
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      return {
        action: 'test',
        domainId: 'integration:google-workspace',
        success: true,
        message: 'Google Workspace refresh token is valid.',
      };
    }
    return {
      action: 'test',
      domainId: 'integration:google-workspace',
      success: false,
      message: 'Google rejected the refresh token. Re-run OAuth.',
    };
  } catch {
    return {
      action: 'test',
      domainId: 'integration:google-workspace',
      success: false,
      message: 'Could not reach Google OAuth token endpoint.',
    };
  }
}

async function testScout(workspaceId: string | null) {
  const saved = await readDomainSettings('scout:endpoint', workspaceId);
  const url = saved['SCOUT_URL'] || process.env.SCOUT_URL || '';
  const apiKey = saved['SCOUT_API_KEY'] || process.env.SCOUT_API_KEY || '';
  if (!url) return { action: 'test', domainId: 'scout:endpoint', success: false, message: 'No Scout URL configured.' };
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers['x-scout-key'] = apiKey;
    const resp = await fetch(url.replace(/\/$/, '') + '/api/ping', { headers, signal: AbortSignal.timeout(8000) });
    if (resp.ok) return { action: 'test', domainId: 'scout:endpoint', success: true, message: `Scout at ${url} is reachable.` };
    return { action: 'test', domainId: 'scout:endpoint', success: false, message: `Scout returned HTTP ${resp.status}.` };
  } catch {
    return { action: 'test', domainId: 'scout:endpoint', success: false, message: `Could not reach Scout at ${url}.` };
  }
}

async function testSearXng(workspaceId: string | null) {
  const saved = await readDomainSettings('search:searxng', workspaceId);
  const url = saved['SEARXNG_URL'] || process.env.SEARXNG_URL || '';
  if (!url) return { action: 'test', domainId: 'search:searxng', success: false, message: 'No SearXNG URL configured.' };
  try {
    const resp = await fetch(url.replace(/\/$/, '') + '/healthz', { signal: AbortSignal.timeout(6000) });
    if (resp.ok) return { action: 'test', domainId: 'search:searxng', success: true, message: `SearXNG at ${url} is reachable.` };
    return { action: 'test', domainId: 'search:searxng', success: false, message: `SearXNG returned HTTP ${resp.status}.` };
  } catch {
    return { action: 'test', domainId: 'search:searxng', success: false, message: `Could not reach SearXNG at ${url}.` };
  }
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

function resolveChannelTarget(target: string) {
  const stripped = target.startsWith('channel:') ? target.slice(8) : target;
  return (
    findChannelByAlias(stripped) ??
    CHANNEL_REQUIREMENTS.find((c) => c.id === stripped) ??
    // Only treat as channel if no settings domain matches
    (findDomainByAlias(stripped) == null
      ? findChannelByAlias(target) ?? CHANNEL_REQUIREMENTS.find((c) => c.id === target) ?? null
      : null)
  );
}

function resolveDomain(target: string): ConfigDomain | null {
  const stripped = target.startsWith('channel:') ? null : target;
  if (!stripped) return null;
  return (
    findDomainByAlias(stripped) ??
    ALL_CONFIG_DOMAINS.find((d) => d.id === stripped) ??
    null
  );
}

function buildNotFoundError(target: string): string {
  return (
    `Unknown configuration target: "${target}". ` +
    `Try: openai, anthropic, deepseek, gemini, telegram, slack, discord, email, timezone, ` +
    `quiet hours, default model, n8n, trello, notion, google workspace, webhooks, companion, scout, tts, or say "configure list" to see all.`
  );
}
