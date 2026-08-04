/**
 * Clean model/tool noise so Aiva replies stay readable for humans.
 * Shared by web chat, Telegram, and episodic hydrate paths.
 */
import { stripTelegramToolStatus } from '../gateway/telegram-format.js';
import { stripWorkingSetDigestsFromHistory } from '../memory/session-working-set.js';
import {
  aivaEmptyReplyFallback as buildAivaEmptyReplyFallback,
  resolveAivaEmptyReplyBucket as classifyAivaEmptyReplyBucket,
} from './aiva-empty-reply.js';

const COST_PREFLIGHT_RE =
  /^\[Cost preflight:[^\]]*\]\s*/i;
const WORKING_SET_UPDATED_RE =
  /\n?\n?Working set updated \(\d+ tool results\)\. Full evidence is in ACTIVE WORKING SET for follow-ups\.?/gi;
const DURABLE_DEMOTED_RE =
  /\n?\[Durable memory demoted:[^\]]*\]/gi;
const BRACKET_STATUS_RE =
  /^\[(Turn cancelled|Steer|Queued:[^\]]*|LLM budget blocked[^\]]*|iteration[^\]]*)\]\s*/gim;
const CALLED_TOOLS_RE =
  /^[ \t]*\[Called tools:[^\]]*\][ \t]*\n?/gim;
const LEARNING_NOTICE_RE =
  /\n?\(?\s*noted your correction[^\n)]*\)?\s*/gi;
const LEARNING_PAREN_RE =
  /\n?\((?:saved approach|refined skill|updated your preference|learned your preference|kept skill|indexed work summary)[^)]*\)\s*/gi;

export function sanitizeAivaUserFacingReply(raw: string): string {
  let text = String(raw ?? '').replace(/\r\n/g, '\n');
  if (!text.trim()) return '';

  text = stripTelegramToolStatus(text);
  text = stripWorkingSetDigestsFromHistory(text);
  text = text.replace(WORKING_SET_UPDATED_RE, '');
  text = text.replace(DURABLE_DEMOTED_RE, '');
  text = text.replace(COST_PREFLIGHT_RE, '');
  text = text.replace(BRACKET_STATUS_RE, '');
  text = text.replace(CALLED_TOOLS_RE, '');
  text = text.replace(LEARNING_NOTICE_RE, '');
  text = text.replace(LEARNING_PAREN_RE, '');

  // Drop orphaned JSON dumps that sometimes trail a short prose answer.
  text = text.replace(/\n\{[\s\S]{80,}\}\s*$/g, (block) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('{') && /"(ok|data|results|contacts|files|error)"\s*:/.test(trimmed)) {
      return '';
    }
    return block;
  });

  // Prefer paragraph air: collapse 3+ blank lines to 2, trim edges.
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Soft writing-style: convert common em/en dash leftovers in outbound chat.
  text = text.replace(/\u2014|\u2013/g, ';');

  return text;
}

/**
 * User-facing copy when a turn produced no readable prose (common after tool-status-only
 * replies or blank model content). Prefer this over a generic greeting.
 */
export function aivaEmptyReplyFallback(userMessage?: string): string {
  return buildAivaEmptyReplyFallback(userMessage);
}

export function resolveAivaEmptyReplyBucket(userMessage?: string) {
  return classifyAivaEmptyReplyBucket(userMessage);
}
