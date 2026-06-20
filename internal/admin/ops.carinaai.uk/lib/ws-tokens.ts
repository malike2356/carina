import { randomUUID } from 'node:crypto';

const TOKEN_TTL_MS = 5 * 60 * 1000;
const tokens = new Map<string, number>();

export function issueWsToken(): string {
  const token = randomUUID();
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function consumeWsToken(token: string): boolean {
  const expires = tokens.get(token);
  if (!expires) return false;
  tokens.delete(token);
  if (expires < Date.now()) return false;
  return true;
}

export function peekWsToken(token: string): boolean {
  const expires = tokens.get(token);
  return Boolean(expires && expires >= Date.now());
}

export function clearWsTokens(): void {
  tokens.clear();
}
