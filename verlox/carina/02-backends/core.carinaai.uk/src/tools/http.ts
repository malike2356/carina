import type { Tool } from '../types/index.js';
import { evaluateUrlSafety } from '../security/path-safety.js';
import {
  egressFilter,
  EgressBlockedError,
  DataLeakError,
} from '../security/egress-filter.js';
import { checkHoneypotApiKey } from '../security/honeypot-client.js';
import { isOperatorBlocked } from '../security/kill-switch-listener.js';

const TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 50 * 1024;

function isBlockedHost(hostname: string): boolean {
  const result = evaluateUrlSafety(`https://${hostname}/`, {
    httpsOnly: true,
    blockPrivateHosts: true,
    useEgressFilter: false,
  });
  return !result.allowed && (result.code === 'PRIVATE_HOST' || result.code === 'INVALID_URL');
}

async function getEgressFilter() {
  if (process.env.LABYRINTH_ENABLED !== 'true') return null;
  return egressFilter;
}

export const httpTool: Tool = {
  name: 'http-request',
  dangerous: true,
  requiresConfirmation: true,
  description: 'Make an HTTPS request to an external API.',
  parameters: {
    type: 'object',
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
      url: { type: 'string', description: 'HTTPS URL only' },
      headers: { type: 'object', description: 'Request headers' },
      body: { type: 'string', description: 'Request body (string or JSON)' },
    },
    required: ['method', 'url'],
  },
  execute: async (params) => {
    const method = String(params.method ?? 'GET').toUpperCase();
    const urlStr = String(params.url ?? '');

    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new Error('Invalid URL.');
    }

    if (parsed.protocol !== 'https:') {
      throw new Error('Only https:// URLs are allowed.');
    }

    const urlSafety = evaluateUrlSafety(urlStr, {
      httpsOnly: true,
      blockPrivateHosts: true,
      useEgressFilter: process.env.CARINA_EGRESS_FILTER === 'true',
    });
    if (!urlSafety.allowed) {
      throw new Error(urlSafety.reason);
    }

    if (isBlockedHost(parsed.hostname)) {
      throw new Error('Requests to internal or localhost addresses are blocked.');
    }

    // Operator blocks take precedence over the static egress allowlist.
    if (process.env.LABYRINTH_ENABLED === 'true') {
      const instanceId =
        process.env.SCOUT_INSTANCE_ID ??
        process.env.LABYRINTH_INSTANCE_ID ??
        'carina-local';
      if (isOperatorBlocked(instanceId, parsed.hostname)) {
        return {
          error: `Domain "${parsed.hostname}" is blocked by security policy.`,
        };
      }
    }

    const headers = (params.headers ?? {}) as Record<string, string>;
    let body: string | undefined;
    if (params.body !== undefined && params.body !== null) {
      body = typeof params.body === 'string' ? params.body : JSON.stringify(params.body);
    }

    const filter = await getEgressFilter();
    if (filter) {
      try {
        await filter.checkRequest(urlStr, body);
      } catch (err: unknown) {
        if (err instanceof EgressBlockedError) {
          return { error: 'Request blocked by Labyrinth Egress Filter: domain not in allowlist' };
        }
        if (err instanceof DataLeakError) {
          return { error: 'Request blocked: outbound body contains sensitive credentials' };
        }
        throw err;
      }
    }

    if (process.env.LABYRINTH_ENABLED === 'true') {
      const authHeader = headers.Authorization ?? headers.authorization;
      if (typeof authHeader === 'string') {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch?.[1]) {
          void checkHoneypotApiKey(bearerMatch[1], { tool: 'http-request', url: urlStr });
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(urlStr, {
        method,
        headers,
        body: method === 'GET' || method === 'DELETE' ? undefined : body,
        signal: controller.signal,
      });

      const raw = await res.text();
      const truncated = raw.length > MAX_BODY_BYTES;
      const responseBody = truncated
        ? `${raw.slice(0, MAX_BODY_BYTES)}\n[truncated at ${MAX_BODY_BYTES} bytes]`
        : raw;

      if (filter) {
        void filter.checkResponse(urlStr, responseBody);
      }

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      return { status: res.status, headers: resHeaders, body: responseBody };
    } finally {
      clearTimeout(timer);
    }
  },
};
