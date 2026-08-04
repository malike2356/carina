export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  channelId?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export function chunkTokens(tokens: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    chunks.push(tokens.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  if (messages.length === 0) return [];

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Expo push ${response.status}: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as { data?: ExpoPushTicket[] };
  return payload.data ?? [];
}

export async function sendExpoPushToTokens(
  tokens: string[],
  content: Omit<ExpoPushMessage, 'to'>,
): Promise<ExpoPushTicket[]> {
  const valid = tokens.filter((token) => token.startsWith('ExponentPushToken['));
  if (valid.length === 0) return [];

  const tickets: ExpoPushTicket[] = [];
  for (const group of chunkTokens(valid)) {
    const messages = group.map((token) => ({ ...content, to: token }));
    const batch = await sendExpoPush(messages);
    tickets.push(...batch);
  }
  return tickets;
}
