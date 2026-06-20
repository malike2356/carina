import { normalizeGatewayUrl } from '@/lib/url-utils';

export function gatewayWebSocketUrl(baseUrl: string): string {
  const normalized = normalizeGatewayUrl(baseUrl);
  const parsed = new URL(normalized);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = '/api/companion/ws';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}
