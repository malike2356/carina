import type { Message as TelegramMessage } from 'node-telegram-bot-api';
import type { CarinaMessage } from '../types/index.js';

const responded = new Map<string, number>();
const TTL_MS = 10 * 60_000;

export interface GroupDecisionContext {
  message: Pick<CarinaMessage, 'source' | 'content' | 'chatType' | 'mentioned' | 'chatId' | 'messageId'>;
  botUsername?: string;
}

export function wasMentioned(message: TelegramMessage, botUsername: string): boolean {
  const username = botUsername.replace(/^@/, '').toLowerCase();
  const text = message.text ?? '';

  for (const entity of message.entities ?? []) {
    if (entity.type !== 'mention') continue;
    const mention = text.slice(entity.offset, entity.offset + entity.length).replace(/^@/, '').toLowerCase();
    if (mention === username) return true;
  }

  const repliedTo = message.reply_to_message?.from;
  return Boolean(repliedTo?.is_bot && repliedTo.username?.toLowerCase() === username);
}

export function shouldRespondInGroup(context: GroupDecisionContext): { respond: boolean; reason: string } {
  const { message } = context;
  if (message.source !== 'telegram' || message.chatType !== 'group') {
    return { respond: true, reason: 'not a telegram group' };
  }
  if (message.chatId && message.messageId && hasRecentlyResponded(message.chatId, message.messageId)) {
    return { respond: false, reason: 'already responded to this message' };
  }
  if (message.mentioned) {
    return { respond: true, reason: 'bot was mentioned or replied to' };
  }
  if (looksLikeDirectQuestion(message.content)) {
    return { respond: true, reason: 'ambiguous group question; let the agent decide whether to answer' };
  }
  return { respond: false, reason: 'group message was not directed at Carina' };
}

export function hasRecentlyResponded(chatId: string | number, messageId: string | number): boolean {
  cleanup();
  return responded.has(key(chatId, messageId));
}

export function recordGroupResponse(chatId: string | number, messageId: string | number): void {
  cleanup();
  responded.set(key(chatId, messageId), Date.now());
}

export function clearGroupResponseTracking(): void {
  responded.clear();
}

function looksLikeDirectQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('?') && /\b(carina|bot|assistant|agent|status|deploy|can you|could you)\b/.test(lower);
}

function key(chatId: string | number, messageId: string | number): string {
  return `${chatId}:${messageId}`;
}

function cleanup(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, ts] of responded) {
    if (ts < cutoff) responded.delete(id);
  }
}
