export interface JitGrant {
  toolName: string;
  scopeKey: string;
  expiresAt: number;
  usesRemaining: number;
}

export class JitCredentialError extends Error {
  readonly code = 'JIT_CREDENTIAL_REQUIRED';

  constructor(toolName: string) {
    super(`Tool "${toolName}" requires a just-in-time credential grant. Confirm the operation to proceed.`);
    this.name = 'JitCredentialError';
  }
}

const DEFAULT_JIT_TOOLS = ['shell-exec', 'email-send', 'file-write', 'http-request', 'code-exec'];

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function scopeKeyFor(toolName: string, params: Record<string, unknown>): string {
  if (toolName === 'file-write' || toolName === 'file-read') {
    const path = params.path ?? params.file;
    return typeof path === 'string' ? path : '*';
  }
  if (toolName === 'http-request') {
    const url = params.url;
    return typeof url === 'string' ? new URL(url).hostname : '*';
  }
  if (toolName === 'shell-exec' || toolName === 'code-exec') {
    const cmd = params.command ?? params.code;
    return typeof cmd === 'string' ? cmd.slice(0, 120) : '*';
  }
  if (toolName === 'email-send') {
    const to = params.to;
    return typeof to === 'string' ? to : '*';
  }
  return '*';
}

export function isJitCredentialsEnabled(): boolean {
  if (process.env.JIT_CREDENTIALS_ENABLED === 'false') return false;
  return process.env.JIT_CREDENTIALS_ENABLED === 'true' || process.env.LABYRINTH_ENABLED === 'true';
}

export function resolveJitTools(): string[] {
  const raw = process.env.JIT_CREDENTIAL_TOOLS?.trim();
  if (!raw) return [...DEFAULT_JIT_TOOLS];
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

export class JitCredentialStore {
  private readonly grants = new Map<string, JitGrant[]>();

  private sessionKey(sessionId: string, toolName: string, scopeKey: string): string {
    return `${sessionId}:${toolName}:${scopeKey}`;
  }

  issueGrant(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>,
    uses = 1,
    ttlMs = DEFAULT_TTL_MS,
  ): JitGrant {
    const scopeKey = scopeKeyFor(toolName, params);
    const grant: JitGrant = {
      toolName,
      scopeKey,
      expiresAt: Date.now() + ttlMs,
      usesRemaining: uses,
    };
    const key = this.sessionKey(sessionId, toolName, scopeKey);
    const list = this.grants.get(key) ?? [];
    list.push(grant);
    this.grants.set(key, list);
    return grant;
  }

  hasValidGrant(sessionId: string, toolName: string, params: Record<string, unknown>): boolean {
    const scopeKey = scopeKeyFor(toolName, params);
    const key = this.sessionKey(sessionId, toolName, scopeKey);
    const list = this.grants.get(key) ?? [];
    const now = Date.now();
    const valid = list.filter((g) => g.expiresAt > now && g.usesRemaining > 0);
    this.grants.set(key, valid);
    return valid.length > 0;
  }

  consumeGrant(sessionId: string, toolName: string, params: Record<string, unknown>): void {
    const scopeKey = scopeKeyFor(toolName, params);
    const key = this.sessionKey(sessionId, toolName, scopeKey);
    const list = this.grants.get(key) ?? [];
    const now = Date.now();
    for (const grant of list) {
      if (grant.expiresAt <= now || grant.usesRemaining <= 0) continue;
      grant.usesRemaining -= 1;
      break;
    }
    this.grants.set(key, list.filter((g) => g.expiresAt > now && g.usesRemaining > 0));
  }

  revokeSession(sessionId: string): void {
    for (const key of [...this.grants.keys()]) {
      if (key.startsWith(`${sessionId}:`)) this.grants.delete(key);
    }
  }

  reset(): void {
    this.grants.clear();
  }
}

let store: JitCredentialStore | null = null;

export function getJitCredentialStore(): JitCredentialStore {
  if (!store) store = new JitCredentialStore();
  return store;
}

export function _resetJitCredentialStore(): void {
  store = null;
}

export function requiresJitGrant(toolName: string): boolean {
  if (!isJitCredentialsEnabled()) return false;
  return resolveJitTools().includes(toolName);
}

export function assertJitGrant(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): void {
  if (!requiresJitGrant(toolName)) return;
  if (params._jit_granted === true) return;
  const jitStore = getJitCredentialStore();
  if (jitStore.hasValidGrant(sessionId, toolName, params)) return;
  throw new JitCredentialError(toolName);
}

export function issueJitGrantAfterConfirm(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): void {
  if (!requiresJitGrant(toolName)) return;
  getJitCredentialStore().issueGrant(sessionId, toolName, params);
}

export function consumeJitGrant(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): void {
  if (!requiresJitGrant(toolName)) return;
  getJitCredentialStore().consumeGrant(sessionId, toolName, params);
}
