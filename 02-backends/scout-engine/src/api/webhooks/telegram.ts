import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { getRedis } from '../../event-server/redis.js';
import type { ControlMetadata } from '../../messaging/control.js';
import { createChannelLinkService } from '../../messaging/channel-links.js';

type TelegramUser = {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramChat = {
  id: number | string;
  type?: string;
};

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat?: TelegramChat;
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: TelegramUser;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

interface TelegramControlState {
  nonce: string;
  organizationId: string;
  command: string;
  args: string[];
  channelUserRef: string;
  chatRef: string;
  dashboardUserId: string;
  reason: string | null;
}

interface PendingConfirmation {
  state: TelegramControlState;
  expiresAt: number;
}

const NONCE_PREFIX = 'scout:telegram:control:';
const CONFIRM_TTL_SECONDS = 30;
const pendingConfirmations = new Map<string, PendingConfirmation>();

function parseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function commandName(text: string): string {
  const first = text.trim().split(/\s+/)[0] ?? '';
  return first.startsWith('/') ? first.slice(1).toLowerCase() : first.toLowerCase();
}

function commandArgs(text: string): string[] {
  return text.trim().split(/\s+/).slice(1);
}

function chatIdOf(message?: TelegramMessage): string {
  return message?.chat?.id !== undefined ? String(message.chat.id) : '';
}

function userIdOf(user?: TelegramUser): string {
  return user?.id !== undefined ? String(user.id) : '';
}

function displayName(user?: TelegramUser): string {
  return user?.username?.trim()
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
    || userIdOf(user);
}

async function sendTelegramMessage(chatId: string, text: string, extra?: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(extra ?? {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-engine:telegram] sendMessage failed:', msg);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-engine:telegram] answerCallbackQuery failed:', msg);
  }
}

async function setPendingConfirmation(state: TelegramControlState): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.setex(`${NONCE_PREFIX}${state.nonce}`, CONFIRM_TTL_SECONDS, JSON.stringify(state));
    return;
  }
  pendingConfirmations.set(state.nonce, {
    state,
    expiresAt: Date.now() + CONFIRM_TTL_SECONDS * 1000,
  });
}

async function getPendingConfirmation(nonce: string): Promise<TelegramControlState | null> {
  const redis = getRedis();
  if (redis) {
    const payload = await redis.get(`${NONCE_PREFIX}${nonce}`);
    return payload ? parseJson<TelegramControlState>(payload) : null;
  }

  const entry = pendingConfirmations.get(nonce);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingConfirmations.delete(nonce);
    return null;
  }
  return entry.state;
}

async function deletePendingConfirmation(nonce: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`${NONCE_PREFIX}${nonce}`);
    return;
  }
  pendingConfirmations.delete(nonce);
}

function helpText(): string {
  return [
    'Scout control commands:',
    '/status',
    '/help',
    '/pause <agent_id>',
    '/suspend-channel <telegram|whatsapp|slack>',
    '/quarantine <tool_name> [agent_id|all]',
    '/restrict',
    '/freeze',
    '/kill',
    '/resume [agent_id]',
    '/start <link_code>',
  ].join('\n');
}

async function getPanicMode(organizationId: string): Promise<boolean> {
  const { pool } = await import('../../event-server/db.js');
  return createChannelLinkService({
    pool,
    now: () => new Date(),
  }).getPanicMode(organizationId);
}

function buildMetadata(state: TelegramControlState): ControlMetadata {
  return {
    organizationId: state.organizationId,
    dashboardUserId: state.dashboardUserId,
    channel: 'telegram',
    channelUserRef: state.channelUserRef,
    chatRef: state.chatRef,
    command: state.command,
    reason: state.reason ?? state.command,
    source: 'telegram',
    actor: state.channelUserRef,
    confirmed: true,
    plan: process.env.SCOUT_OPERATOR_PLAN?.trim() || 'enterprise',
  };
}

async function runControlAction(state: TelegramControlState): Promise<{ ok: true; text: string } | { ok: false; text: string; code?: string }> {
  const { getControlService } = await import('../../messaging/control-defaults.js');
  const control = getControlService();
  const meta = buildMetadata(state);
  const args = state.args;

  if (state.command === 'kill') {
    const before = await control.getStatus(state.organizationId);
    const outcome = await control.killOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    const activeCount = typeof before.agents === 'object' && before.agents && 'active' in before.agents
      ? Number((before.agents as Record<string, unknown>).active ?? 0)
      : 0;
    return { ok: true, text: `All ${activeCount || 'all'} agents halted.\nAudit: ${outcome.audit_code}` };
  }

  if (state.command === 'freeze') {
    const outcome = await control.freezeOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Organization frozen.\nAudit: ${outcome.audit_code}` };
  }

  if (state.command === 'restrict') {
    const outcome = await control.restrictOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Organization restricted.\nAudit: ${outcome.audit_code}` };
  }

  if (state.command === 'pause') {
    const agentId = args[0];
    if (!agentId) return { ok: false, text: 'ambiguous', code: 'ambiguous' };
    const outcome = await control.pauseAgent(state.organizationId, agentId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Agent ${agentId} paused.\nAudit: ${outcome.audit_code}` };
  }

  if (state.command === 'resume') {
    const agentId = args[0];
    const outcome = agentId
      ? await control.resumeAgent(state.organizationId, agentId, meta)
      : await control.resumeOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return {
      ok: true,
      text: agentId
        ? `Agent ${agentId} resumed.\nAudit: ${outcome.audit_code}`
        : `All agents resumed.\nAudit: ${outcome.audit_code}`,
    };
  }

  if (state.command === 'suspend-channel') {
    const channel = args[0];
    if (!channel || (channel !== 'telegram' && channel !== 'whatsapp' && channel !== 'slack')) {
      return { ok: false, text: 'ambiguous', code: 'ambiguous' };
    }
    const outcome = await control.suspendChannel(state.organizationId, channel, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Channel ${channel} suspended.\nAudit: ${outcome.audit_code}` };
  }

  if (state.command === 'quarantine') {
    const toolName = args[0];
    const agentId = args[1] ?? 'all';
    if (!toolName) return { ok: false, text: 'ambiguous', code: 'ambiguous' };
    const outcome = await control.quarantineTool(state.organizationId, agentId, toolName, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Tool ${toolName} quarantined.\nAudit: ${outcome.audit_code}` };
  }

  if (state.command === 'status') {
    const status = await control.getStatus(state.organizationId);
    const agents = status.agents as Record<string, unknown> | undefined;
    return {
      ok: true,
      text: `Status: active=${Number(agents?.active ?? 0)}, suspended=${Number(agents?.suspended ?? 0)}, offline=${Number(agents?.offline ?? 0)}, linked_channels=${Number(status.linked_channels ?? 0)}`,
    };
  }

  return { ok: false, text: 'ambiguous', code: 'ambiguous' };
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  const text = parseString(message.text);
  const chatId = chatIdOf(message);
  const user = message.from;
  if (!text || !chatId || !user) return;

  const channelUserRef = userIdOf(user);
  const command = commandName(text);
  const args = commandArgs(text);

  if (command === 'start') {
    const code = args[0];
    if (!code) return;
    const { pool } = await import('../../event-server/db.js');
    const result = await createChannelLinkService({
      pool,
      now: () => new Date(),
    }).consumeLinkCode({
      code,
      channel: 'telegram',
      channelUserRef,
      chatRef: chatId,
      confirmedBy: displayName(user),
    });
    if (result.ok) {
      await sendTelegramMessage(chatId, 'Linked. Open Scout Settings -> Channels to manage or revoke this connection.');
    } else {
      await sendTelegramMessage(chatId, result.code === 'expired' ? 'expired' : result.code === 'already_in_state' ? 'already_in_state' : 'not_linked');
    }
    return;
  }

  const { pool } = await import('../../event-server/db.js');
  const linkService = createChannelLinkService({
    pool,
    now: () => new Date(),
  });
  const linked = await linkService.findLinkedOperator('telegram', channelUserRef);
  if (!linked) {
    await sendTelegramMessage(chatId, 'Not linked. Open Scout Settings -> Channels.');
    return;
  }

  if (command === 'help') {
    await sendTelegramMessage(chatId, helpText());
    return;
  }

  const stateBase = {
    nonce: '',
    organizationId: linked.organization_id,
    command,
    args,
    channelUserRef,
    chatRef: chatId,
    dashboardUserId: linked.dashboard_user_id,
    reason: text.slice(text.indexOf(command) + command.length).trim() || command,
  };

  if (command === 'kill' || command === 'freeze' || command === 'restrict') {
    if (command === 'kill' && await getPanicMode(linked.organization_id)) {
      const outcome = await runControlAction(stateBase);
      await sendTelegramMessage(chatId, outcome.ok ? outcome.text : outcome.text);
      return;
    }

    const nonce = crypto.randomBytes(12).toString('hex');
    await setPendingConfirmation({ ...stateBase, nonce });
    await sendTelegramMessage(chatId, `${command} requires confirmation.`, {
      reply_markup: {
        inline_keyboard: [[{ text: 'CONFIRM', callback_data: `scout:confirm:${nonce}` }]],
      },
    });
    return;
  }

  const outcome = await runControlAction(stateBase);
  await sendTelegramMessage(chatId, outcome.ok ? outcome.text : outcome.text);
}

async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
  if (!callbackQuery.data || !callbackQuery.data.startsWith('scout:confirm:')) return;

  const nonce = callbackQuery.data.slice('scout:confirm:'.length);
  const pending = await getPendingConfirmation(nonce);
  if (!pending) {
    await answerCallbackQuery(callbackQuery.id, 'expired');
    return;
  }

  await deletePendingConfirmation(nonce);
  const outcome = await runControlAction(pending);
  await answerCallbackQuery(callbackQuery.id, outcome.ok ? 'confirmed' : outcome.text);

  const chatId = chatIdOf(callbackQuery.message);
  if (chatId) {
    await sendTelegramMessage(chatId, outcome.ok ? outcome.text : outcome.text);
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.message) {
    await handleMessage(update.message);
    return;
  }
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

function verifyTelegramSecret(req: Request, res: Response): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
  if (!expected) {
    res.status(503).json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured' });
    return false;
  }

  const provided = req.header('X-Telegram-Bot-Api-Secret-Token')?.trim() || '';
  if (provided !== expected) {
    res.status(401).json({ error: 'Invalid Telegram webhook secret' });
    return false;
  }

  return true;
}

export const telegramWebhookRouter = Router();

telegramWebhookRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  if (!verifyTelegramSecret(req, res)) return;

  try {
    await handleTelegramUpdate((req.body ?? {}) as TelegramUpdate);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-engine:telegram] webhook error:', msg);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});
