export function buildPlatformFormattingContext(platform?: string): string {
  const surface = platform?.trim().toLowerCase();
  if (!surface) return '';

  if (surface === 'telegram') {
    return [
      'Output format (Telegram):',
      'Keep replies short. Basic Markdown is fine (**bold**, `code`).',
      'Do not use markdown tables; use bullet lists instead.',
      'Avoid walls of text; split ideas across short paragraphs.',
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
