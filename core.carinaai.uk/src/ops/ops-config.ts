export const SANDBOX_LABEL = 'carina.sandbox';
export const SANDBOX_NAME_PREFIX = 'carina-sandbox-';

export function sandboxImage(): string {
  return process.env.CARINA_SANDBOX_IMAGE ?? 'alpine:latest';
}

export function sandboxMemoryMb(): number {
  return Number(process.env.CARINA_SANDBOX_MEMORY_MB ?? '256');
}

export function debugProxyPort(): number {
  return Number(process.env.CARINA_DEBUG_PROXY_PORT ?? '19229');
}

export function opsToken(): string {
  return process.env.CARINA_OPS_TOKEN ?? process.env.CARINA_WEB_PASSWORD ?? '';
}
