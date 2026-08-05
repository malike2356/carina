export function buildPlatformFormattingContext(platform?: string): string {
  const surface = platform?.trim().toLowerCase();
  if (!surface) return '';

  if (surface === 'telegram') {
    return [
      'Output format (Telegram, SPEED MODE):',
      'Reply in under ~600 characters unless the user explicitly asks for a long document.',
      'One short answer: 1-3 short paragraphs or a tight bullet list. No preamble.',
      'Never write chain-of-thought, planning, or "let me check" narration into the reply.',
      'Never narrate tool use. Never append tool dumps, JSON, or working-set evidence.',
      'Do not use markdown tables. Bold only key names/times with **like this**.',
      'Prefer answering from known context; use at most 1-2 tool rounds unless blocked.',
      'Do not split one answer across multiple bot messages.',
      'Ask at most one clarifying question, and only if you cannot act without it.',
    ].join(' ');
  }

  if (surface === 'web' || surface === 'aiva') {
    return [
      'Output format (Aiva web chat, SPEED MODE):',
      'Lead with the answer. Keep replies short and scannable: short paragraphs, blank lines between them.',
      'Default to under ~1200 characters unless the user asked for a long deliverable (playbook, draft, analysis).',
      'Never write chain-of-thought, planning monologue, or "let me check" into the visible reply.',
      'Use ## headings sparingly and - bullets for lists. Bold key names, phones, emails with **like this**.',
      'Never narrate tool use. Never append working-set digests, JSON tool dumps, or debug evidence.',
      'Prefer one clear answer over a wall of text. Stop when the question is answered.',
    ].join(' ');
  }

  if (surface === 'discord') {
    return [
      'Output format (Discord):',
      'Do not use markdown tables; use bullet lists.',
      'Wrap bare URLs in angle brackets when listing multiple links to reduce embed spam.',
      'Prefer short paragraphs over heavy formatting.',
    ].join(' ');
  }

  if (surface === 'slack') {
    return [
      'Output format (Slack):',
      'Do not use markdown tables; use bullet lists or simple mrkdwn.',
      'Keep messages scannable; avoid nested formatting the client may strip.',
    ].join(' ');
  }

  if (surface === 'whatsapp') {
    return [
      'Output format (WhatsApp, SPEED MODE):',
      'Plain text only. Under ~500 characters by default. No markdown tables, headers, or code fences.',
      'No chain-of-thought. Answer first. Use CAPS or short labels for emphasis. Bullets with "-".',
      'At most 1-2 tool rounds unless blocked.',
    ].join(' ');
  }

  if (surface === 'sms' || surface === 'signal') {
    return [
      `Output format (${surface}, SPEED MODE):`,
      'Plain text only. Very short replies (under ~280 characters when possible). No tables or markdown.',
      'No chain-of-thought. Answer or ask one question.',
    ].join(' ');
  }

  return '';
}
