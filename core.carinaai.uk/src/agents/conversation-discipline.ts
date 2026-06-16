const CASUAL_EXACT = new Set([
  'hi',
  'hey',
  'hello',
  'hiya',
  'thanks',
  'thank you',
  'thx',
  'ok',
  'okay',
  'k',
  'lol',
  'nice',
  'yo',
  'test',
  'cool',
  'yep',
  'nope',
  'bye',
  'good morning',
  'good night',
  'cheers',
  'np',
  'welcome',
]);

const TASK_VERB = /\b(run|fix|deploy|create|write|check|show|list|find|build|delete|update|help me|remember|search|read|send|email|schedule)\b/i;

export function normalizeCasualText(text: string): string {
  return text.trim().replace(/[!?.]+$/g, '').toLowerCase();
}

export function extractUserMessageForClassification(userMessage: string): string {
  const marker = '\n\nMessage:\n';
  const idx = userMessage.lastIndexOf(marker);
  if (idx >= 0) return userMessage.slice(idx + marker.length).trim();
  const taskMarker = '\n\nTask:\n';
  const taskIdx = userMessage.lastIndexOf(taskMarker);
  if (taskIdx >= 0) return userMessage.slice(taskIdx + taskMarker.length).trim();
  return userMessage.trim();
}

export function isCasualMessage(userMessage: string): boolean {
  const text = normalizeCasualText(extractUserMessageForClassification(userMessage));
  if (!text) return false;
  if (text.includes('?')) return false;
  if (TASK_VERB.test(text)) return false;
  if (CASUAL_EXACT.has(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && /^(hi|hey|hello|thanks|thank you|ok|okay|lol|nice|yo|cheers|good morning|good night)\b/.test(text)) {
    return true;
  }
  return false;
}

export function buildCasualMessagesBlock(): string {
  return [
    'Casual messages:',
    'Not every message needs tools or deep analysis.',
    'For casual input (hi, hey, thanks, ok, test, yo, lol, nice, cheers) or simple acknowledgments with no task attached: answer in one line, no tools, no capability tour.',
    'Match the energy. Do not overthink banter.',
    'Only escalate to tools when the operator is clearly asking for work.',
  ].join('\n');
}

export function buildGroupChatBlock(): string {
  return [
    'Group chats:',
    'Humans do not reply to every message. Neither should you.',
    'Respond when: you are mentioned or replied to; the operator clearly asks you a question; you can add genuine value that nobody else covered.',
    'Stay silent when: it is casual banter between humans; someone already answered; the thread is flowing fine without you.',
    'In group context, if no response is needed, reply exactly: NO_RESPONSE_NEEDED',
    'Quality over quantity. One concise reply, not several fragments.',
  ].join('\n');
}

export function buildConversationDisciplineBlock(): string {
  return [buildCasualMessagesBlock(), '', buildGroupChatBlock()].join('\n');
}

export function buildCasualMessageContext(): string {
  return [
    'Incoming message type: casual.',
    'Reply in one line with no tools unless the operator clearly asked for work in the same message.',
  ].join(' ');
}
