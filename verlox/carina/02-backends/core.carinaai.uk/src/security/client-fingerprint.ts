/**
 * Stable client fingerprint from request metadata.
 * Stores hashes only; never persists raw IP or full UA in the fingerprint id.
 */

import crypto from 'crypto';
import type { Request } from 'express';

export interface ClientFingerprintParts {
  fingerprint: string;
  ipHash: string;
  uaHash: string;
  uaSummary: string;
  clientHint: string | null;
}

function sha16(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function summarizeUserAgent(ua: string): string {
  const raw = String(ua || '').trim();
  if (!raw) return 'unknown';
  const lower = raw.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic')) return 'Claude agent';
  if (lower.includes('openai') || lower.includes('chatgpt')) return 'OpenAI agent';
  if (lower.includes('curl/')) return 'curl';
  if (lower.includes('python-requests') || lower.includes('httpx')) return 'Python client';
  if (lower.includes('node-fetch') || lower.includes('undici') || lower.includes('axios')) {
    return 'Node client';
  }
  if (lower.includes('okhttp') || lower.includes('dalvik')) return 'Android client';
  if (lower.includes('cfnetwork') || lower.includes('darwin')) return 'Apple client';
  if (lower.includes('mozilla/')) return 'Browser';
  return raw.slice(0, 48);
}

export function extractClientIp(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

export function buildClientFingerprint(
  req: Request,
  opts?: { tenantId?: string; tokenId?: string },
): ClientFingerprintParts {
  const ua = String(req.headers['user-agent'] ?? '');
  const ip = extractClientIp(req);
  const clientHint = String(
    req.headers['x-carina-client-id']
      ?? req.headers['x-agent-id']
      ?? req.headers['x-client-id']
      ?? '',
  ).trim() || null;
  const ipHash = sha16(ip);
  const uaHash = sha16(ua || 'none');
  const material = [
    opts?.tenantId ?? '',
    opts?.tokenId ?? '',
    ipHash,
    uaHash,
    clientHint ?? '',
  ].join('|');
  return {
    fingerprint: sha16(material),
    ipHash,
    uaHash,
    uaSummary: summarizeUserAgent(ua),
    clientHint,
  };
}
