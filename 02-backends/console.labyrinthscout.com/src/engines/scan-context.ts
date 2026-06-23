import type { TargetType } from '../findings/types.js';

export interface ScanContext {
  domain: string;
  host: string;
  targetType: TargetType;
  config?: Record<string, unknown>;
}

export function targetUrl(domain: string, scheme: 'https' | 'http' = 'https'): string {
  return `${scheme}://${domain}`;
}
