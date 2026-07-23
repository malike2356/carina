import {
  createWorkerChannel,
  generateEmailSlug,
} from './channel-store.js';
import { registerChannel } from './worker-registry.js';
import { registerTelegramWebhook } from './adapters/telegram-adapter.js';
import { normalizeSmsNumber } from './adapters/sms-adapter.js';
import {
  ensureDiscordGateway,
  resolveDiscordApplicationId,
} from './adapters/discord-gateway.js';
import {
  isSocialAivaChannel,
  socialCredentialsComplete,
} from './social-channel-utils.js';
import { getWorker } from '../workers/worker-store.js';
import { assertCanAddConnectedChannel } from '../billing/aiva-plan-gates.js';
import type { AivaChannelName, WorkerChannelRow } from './types.js';

export class WorkerChannelConnectError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 400,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WorkerChannelConnectError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function isTelegramBotToken(value: string): boolean {
  return /^\d+:[A-Za-z0-9_-]+$/.test(value.trim());
}

function cloneCredentials(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const cleaned = String(value ?? '').trim();
    if (cleaned) out[key] = cleaned;
  }
  return out;
}

export async function connectWorkerChannel(params: {
  workspaceId: string;
  workerId: string;
  channel: AivaChannelName;
  credentials?: Record<string, string>;
  identifier?: string;
}): Promise<WorkerChannelRow> {
  const credentials = cloneCredentials(params.credentials ?? {});
  let identifier = params.identifier?.trim() ?? '';

  const worker = await getWorker(params.workspaceId, params.workerId);
  if (!worker) {
    throw new WorkerChannelConnectError('Worker not found', 404, 'WORKER_NOT_FOUND');
  }

  if (params.channel === 'email' && !identifier) {
    identifier = generateEmailSlug(worker.name, worker.id);
    credentials.from_address = identifier;
  }

  if (params.channel === 'telegram') {
    const botToken = credentials.bot_token ?? credentials.token ?? '';
    if (!botToken || !isTelegramBotToken(botToken)) {
      throw new WorkerChannelConnectError(
        'Telegram requires a valid BotFather bot token',
        400,
        'INVALID_TELEGRAM_TOKEN',
      );
    }
    credentials.bot_token = botToken;
    delete credentials.token;
    identifier = params.workerId;
    await registerTelegramWebhook(botToken, params.workerId);
  }

  if (params.channel === 'whatsapp' && credentials.phone_number_id) {
    identifier = credentials.phone_number_id;
  }

  if (params.channel === 'slack' && credentials.team_id) {
    identifier = credentials.team_id;
  }

  if (params.channel === 'web') {
    identifier = `web:${params.workerId}`;
  }

  if (params.channel === 'sms') {
    const fromNumber = normalizeSmsNumber(String(credentials.from_number ?? ''));
    if (!fromNumber || !credentials.account_sid || !credentials.auth_token) {
      throw new WorkerChannelConnectError(
        'SMS requires account_sid, auth_token, and from_number',
        400,
        'SMS_CREDENTIALS_REQUIRED',
      );
    }
    credentials.from_number = fromNumber;
    identifier = fromNumber;
  }

  if (params.channel === 'discord' && credentials.bot_token) {
    identifier = await resolveDiscordApplicationId(credentials.bot_token);
    credentials.application_id = identifier;
  }

  if (params.channel === 'teams' && credentials.app_id) {
    identifier = credentials.app_id.trim();
    if (!credentials.app_password) {
      throw new WorkerChannelConnectError(
        'Teams requires app_id and app_password',
        400,
        'TEAMS_CREDENTIALS_REQUIRED',
      );
    }
  }

  if (isSocialAivaChannel(params.channel)) {
    if (!identifier) identifier = 'pending';
    if (!socialCredentialsComplete(params.channel, credentials)) {
      throw new WorkerChannelConnectError(
        'OAuth connection required',
        400,
        'OAUTH_REQUIRED',
      );
    }
    if (params.channel === 'linkedin' && credentials.member_id) {
      identifier = credentials.member_id;
    }
    if (params.channel === 'instagram' && credentials.instagram_business_account_id) {
      identifier = credentials.instagram_business_account_id;
    }
    if (params.channel === 'messenger' && credentials.page_id) {
      identifier = credentials.page_id;
    }
    if (params.channel === 'twitter' && credentials.user_id) {
      identifier = credentials.user_id;
    }
    if (params.channel === 'tiktok' && credentials.open_id) {
      identifier = credentials.open_id;
    }
  }

  if (!identifier) {
    throw new WorkerChannelConnectError('identifier is required', 400, 'IDENTIFIER_REQUIRED');
  }

  const gate = await assertCanAddConnectedChannel(
    params.workspaceId,
    params.workerId,
    params.channel,
  );
  if (!gate.allowed) {
    throw new WorkerChannelConnectError(
      `Starter plan allows ${gate.limit} channels (web + 1). Upgrade to Team for all channels.`,
      403,
      'PLAN_UPGRADE_REQUIRED',
      {
        planTier: gate.planTier,
        planRequired: 'team',
        channelLimit: gate.limit,
        connectedCount: gate.connected,
      },
    );
  }

  const row = await createWorkerChannel({
    workerId: params.workerId,
    workspaceId: params.workspaceId,
    channel: params.channel,
    identifier,
    credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
  });

  registerChannel(params.channel, identifier, {
    workerId: params.workerId,
    workspaceId: params.workspaceId,
    channelRowId: row.id,
    credentialBlob: row.credentials.encrypted ?? '',
  });

  if (params.channel === 'discord' && credentials.bot_token) {
    try {
      await ensureDiscordGateway(identifier, credentials.bot_token, params.workerId, params.workspaceId);
    } catch (err) {
      console.warn('[worker-channel-connect] discord gateway start failed:', err);
    }
  }

  return row;
}
