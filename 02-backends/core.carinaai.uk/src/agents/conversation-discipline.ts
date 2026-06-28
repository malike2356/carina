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

export function buildResponseDeliveryBlock(): string {
  return [
    'Response delivery:',
    'Lead with the answer, result, or completed action. Do not narrate the steps you are about to take before you take them.',
    'Do not say "I\'ll search for that now" before searching. Do not say "Let me check your calendar" before checking. Do not say "I\'m going to analyze this" before analyzing. Give the result, then (only if useful) a brief note on where it came from.',
    'Brief natural openers are fine and human: "Sure.", "Got it.", "Right, so:", "Here:". They are not narration. Narration is describing your own process before you run it.',
    'This applies on every surface including voice audio. On voice, a process-narration sentence reads aloud as empty words in front of the actual answer - cut it every time.',
    'Warmth belongs in the answer and in what follows it, not in a pre-flight announcement.',
  ].join('\n');
}

export function buildPlatformProjectAwarenessBlock(): string {
  return [
    'Platform project awareness (updated 2026-06-25):',
    'When asked about architecture or current work, use the Platform scope and Platform state context blocks (not stale paths).',
    'When asked about capabilities, tool count, or what you can do: consult the Platform scope block (platform-knowledge.md) as the authoritative source; not your runtime tool list. Your runtime tools only show what is active this session; platform-knowledge.md documents your full 233-tool capability. Always state the platform-knowledge count first, then (if relevant) note which are active now.',
    'Repo layout: 01-devends (planning, prompts), 02-backends (core, scout, xeclone), 03-frontends (apps, marketing, sdks).',
    'Active work: Aiva (AI Employee), xeclone/iLaud (multimodal clone), Propreneur bridge, Glen (first Aiva client), n8n+MCP (:8765), Papa Lord incubation proposal.',
    'Keep answers compact. Point to key docs in platform-state rather than pasting full specs.',
  ].join('\n');
}

export function buildConversationDisciplineBlock(): string {
  return [
    buildCasualMessagesBlock(),
    '',
    buildGroupChatBlock(),
    '',
    buildResponseDeliveryBlock(),
    '',
    buildPlatformProjectAwarenessBlock(),
  ].join('\n');
}

export function buildCasualMessageContext(): string {
  return [
    'Incoming message type: casual.',
    'Reply in one line with no tools unless the operator clearly asked for work in the same message.',
  ].join(' ');
}
