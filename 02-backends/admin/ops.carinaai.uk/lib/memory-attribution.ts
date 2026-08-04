/**
 * Attribute episodic memory rows to Aiva workers and workspace customers
 * without exposing message plaintext.
 */

export type ParsedAivaSession = {
  workerId: string | null;
  channel: string | null;
  peerId: string | null;
};

export type MemoryAttribution = {
  workerId: string | null;
  aivaName: string | null;
  workspaceId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  channel: string | null;
  peerId: string | null;
  peerDisplayName: string | null;
  /** Who sent this row (customer contact / Aiva / system). */
  actorLabel: string;
  /** Workspace owner label for ops context. */
  customerLabel: string;
};

const UUID_RE =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export function parseAivaSessionId(sessionId: string): ParsedAivaSession {
  const raw = String(sessionId || '').trim();
  const match = raw.match(new RegExp(`^aiva-(${UUID_RE})-(.+)$`, 'i'));
  if (!match) {
    return { workerId: null, channel: null, peerId: null };
  }
  const workerId = match[1];
  const rest = match[2];

  if (rest.startsWith('contact-')) {
    return { workerId, channel: 'contact', peerId: rest.slice('contact-'.length) };
  }
  if (rest === 'web-app') {
    return { workerId, channel: 'web', peerId: 'app' };
  }
  if (rest.startsWith('web-auto-')) {
    return { workerId, channel: 'web', peerId: rest };
  }

  const channelMatch = rest.match(/^([a-z][a-z0-9_]*)-(.+)$/i);
  if (channelMatch) {
    return { workerId, channel: channelMatch[1].toLowerCase(), peerId: channelMatch[2] };
  }

  return { workerId, channel: null, peerId: rest };
}

export function extractWorkerIdFromSession(sessionId: string): string | null {
  return parseAivaSessionId(sessionId).workerId;
}

function customerLabel(name: string | null, email: string | null, workspaceId: string | null): string {
  const n = (name || '').trim();
  const e = (email || '').trim();
  if (n && e) return `${n} · ${e}`;
  if (n) return n;
  if (e) return e;
  if (workspaceId) return `Workspace ${workspaceId.slice(0, 8)}…`;
  return 'Unknown customer';
}

function peerLabel(input: {
  channel: string | null;
  peerId: string | null;
  peerDisplayName: string | null;
  customerName: string | null;
}): string {
  const display = (input.peerDisplayName || '').trim();
  if (display) {
    return input.channel ? `${display} (${input.channel})` : display;
  }
  if (input.peerId === 'app' || input.channel === 'web') {
    const owner = (input.customerName || '').trim();
    if (owner) return `${owner} (web)`;
    return 'Web user';
  }
  if (input.channel && input.peerId) {
    const peer = input.peerId.length > 24 ? `${input.peerId.slice(0, 12)}…` : input.peerId;
    return `${input.channel}:${peer}`;
  }
  if (input.peerId) return input.peerId;
  return 'Unknown user';
}

export function buildMemoryAttribution(input: {
  role: string;
  sessionId: string;
  workerId?: string | null;
  aivaName?: string | null;
  workspaceId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  peerDisplayName?: string | null;
}): MemoryAttribution {
  const parsed = parseAivaSessionId(input.sessionId);
  const workerId = input.workerId || parsed.workerId;
  const channel = parsed.channel;
  const peerId = parsed.peerId;
  const aivaName = (input.aivaName || '').trim() || null;
  const customerName = (input.customerName || '').trim() || null;
  const customerEmail = (input.customerEmail || '').trim() || null;
  const workspaceId = (input.workspaceId || '').trim() || null;
  const peerDisplayName = (input.peerDisplayName || '').trim() || null;

  const customer = customerLabel(customerName, customerEmail, workspaceId);
  const role = String(input.role || '').toLowerCase();

  let actorLabel: string;
  if (role === 'assistant') {
    actorLabel = aivaName ? `Aiva · ${aivaName}` : 'Aiva';
  } else if (role === 'system') {
    actorLabel = 'System';
  } else {
    actorLabel = peerLabel({ channel, peerId, peerDisplayName, customerName });
  }

  return {
    workerId,
    aivaName,
    workspaceId,
    customerName,
    customerEmail,
    channel,
    peerId,
    peerDisplayName,
    actorLabel,
    customerLabel: customer,
  };
}

/** SQL fragment: extract UUID worker id from aiva-* session_id, else null. */
export const SQL_EXTRACT_WORKER_ID = `
  CASE
    WHEN session_id ~ '^aiva-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
    THEN substring(session_id from 6 for 36)
    ELSE NULL
  END
`.trim();
