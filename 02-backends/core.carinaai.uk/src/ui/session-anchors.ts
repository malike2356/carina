export function formatSessionAnchor(label: string, sessionId: string): string {
  const safeLabel = label.trim() || 'Session';
  const safeId = sessionId.trim();
  return `[${safeLabel}](#${safeId})`;
}

export function parseSessionAnchor(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed.startsWith('#')) return null;
  const sessionId = trimmed.slice(1).trim();
  return sessionId.length > 0 ? sessionId : null;
}

export function buildSessionAnchorContext(platform?: string): string | null {
  const surface = platform?.trim().toLowerCase();
  if (surface !== 'web') return null;

  return [
    'Session anchors (web UI):',
    'When referencing another chat session, use markdown links: [Short title](#session-id).',
    'Example: [Yesterday\'s deploy chat](#abc-123).',
    'The web UI treats #session-id links as in-app navigation to that chat.',
    'Use session-search or memory to find session ids; do not invent ids.',
  ].join('\n');
}

export function buildMemorySessionAnchorLine(sessionId: string, role: string, content: string): string {
  const preview = content.replace(/\s+/g, ' ').trim().slice(0, 80);
  const anchor = formatSessionAnchor(preview || sessionId, sessionId);
  return `${anchor} ${role}: ${content}`;
}
