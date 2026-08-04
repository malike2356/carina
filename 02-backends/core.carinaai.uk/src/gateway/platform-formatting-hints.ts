export function buildPlatformFormattingContext(platform?: string): string {
  const surface = platform?.trim().toLowerCase();
  if (!surface) return '';

  if (surface === 'telegram') {
    return [
      'Output format (Telegram):',
      'Send one cohesive reply with blank lines between paragraphs.',
      'Keep each paragraph to 1-3 short sentences.',
      'For schedules, dates, or multiple facts, use a ## heading plus bullet lines (- item).',
      'Bold key names/times with **like this**.',
      'Do not use markdown tables.',
      'Do not narrate tool use (no "[using web-search]").',
      'Do not append tool dumps, JSON, or working-set evidence to the user-facing reply.',
      'Do not split one answer across multiple messages; the gateway keeps it as one message.',
      'End with one clear question only when it helps.',
    ].join(' ');
  }

  if (surface === 'web' || surface === 'aiva') {
    return [
      'Output format (Aiva web chat):',
      'Write a polished, scannable reply: short paragraphs, blank lines between them.',
      'Use ## headings sparingly for multi-part answers, and - bullets for lists of facts.',
      'Bold key names, phone numbers, and emails with **like this**.',
      'Never narrate tool use (no "[using memory...]", no "[using session-search...]").',
      'Never append working-set digests, JSON tool dumps, cost preflight notes, or debug evidence.',
      'Never paste internal orchestration text, screenshots-as-text, or UI chrome into the reply.',
      'Prefer one clear answer over a wall of text.',
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
      'Output format (WhatsApp):',
      'Plain text only. No markdown tables, headers, or code fences.',
      'Use CAPS or short labels for emphasis. Use bullet lines starting with "-".',
    ].join(' ');
  }

  if (surface === 'sms' || surface === 'signal') {
    return [
      `Output format (${surface}):`,
      'Plain text only. Very short replies. No tables or markdown.',
    ].join(' ');
  }

  return '';
}
