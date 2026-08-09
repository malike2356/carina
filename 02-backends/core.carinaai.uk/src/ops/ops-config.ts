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
  // CARINA_OPS_TOKEN is the dedicated inter-service bearer token.
  // Falling back to CARINA_INTERNAL_KEY is kept for compatibility only;
  // new deployments should set CARINA_OPS_TOKEN to a separate random string.
  // Treat empty strings as unset so a blank CARINA_OPS_TOKEN= in env files
  // cannot block the fallback and 401 every cloud proxy call.
  return (
    process.env.CARINA_OPS_TOKEN?.trim()
    || process.env.CARINA_INTERNAL_KEY?.trim()
    || process.env.CARINA_WEB_PASSWORD?.trim()
    || ''
  );
}
