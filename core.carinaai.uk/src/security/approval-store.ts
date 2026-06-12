import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import type { ToolRiskTier } from './tool-risk.js';

export type ApprovalScope = 'global' | 'profile' | 'session';

export type ApprovalRule = {
  id: string;
  action: 'allow' | 'block';
  scope: ApprovalScope;
  scopeId?: string;
  tool?: string;
  riskTier?: ToolRiskTier;
  note?: string;
  createdAt: string;
};

export type ApprovalGrant = {
  id: string;
  tool: string;
  scope: 'profile' | 'session';
  scopeId: string;
  paramsFingerprint?: string;
  expiresAt: string;
  grantedAt: string;
  grantedBy?: string;
};

type ApprovalStoreFile = {
  version: number;
  rules: ApprovalRule[];
  grants: ApprovalGrant[];
  audit: ApprovalAuditEntry[];
};

export type ApprovalAuditEntry = {
  at: string;
  action: string;
  tool?: string;
  scope?: string;
  scopeId?: string;
  detail?: string;
};

const STORE_PATH = path.join(CARINA_HOME, 'approvals.json');
let cached: ApprovalStoreFile | null = null;

function emptyStore(): ApprovalStoreFile {
  return { version: 1, rules: [], grants: [], audit: [] };
}

function loadStore(): ApprovalStoreFile {
  if (cached) return cached;
  if (!fs.existsSync(STORE_PATH)) {
    cached = emptyStore();
    return cached;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as ApprovalStoreFile;
    cached = {
      ...emptyStore(),
      ...raw,
      rules: raw.rules ?? [],
      grants: raw.grants ?? [],
      audit: raw.audit ?? [],
    };
    return cached;
  } catch {
    cached = emptyStore();
    return cached;
  }
}

function saveStore(store: ApprovalStoreFile): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
  cached = store;
}

export function resetApprovalStoreCache(): void {
  cached = null;
}

export function listApprovalRules(): ApprovalRule[] {
  return [...loadStore().rules];
}

export function listApprovalGrants(includeExpired = false): ApprovalGrant[] {
  const now = Date.now();
  return loadStore().grants.filter((g) =>
    includeExpired || new Date(g.expiresAt).getTime() > now);
}

export function listApprovalAudit(limit = 50): ApprovalAuditEntry[] {
  return loadStore().audit.slice(-limit);
}

export function paramsFingerprint(params: Record<string, unknown>): string {
  const stable = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

export function addApprovalRule(rule: Omit<ApprovalRule, 'id' | 'createdAt'>): ApprovalRule {
  const store = loadStore();
  const entry: ApprovalRule = {
    ...rule,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  store.rules.push(entry);
  appendAudit(store, { action: 'rule.add', tool: entry.tool, scope: entry.scope, scopeId: entry.scopeId, detail: entry.action });
  saveStore(store);
  return entry;
}

export function removeApprovalRule(id: string): boolean {
  const store = loadStore();
  const before = store.rules.length;
  store.rules = store.rules.filter((r) => r.id !== id);
  if (store.rules.length === before) return false;
  appendAudit(store, { action: 'rule.remove', detail: id });
  saveStore(store);
  return true;
}

export function grantApproval(input: {
  tool: string;
  scope: 'profile' | 'session';
  scopeId: string;
  ttlMs: number;
  params?: Record<string, unknown>;
  grantedBy?: string;
}): ApprovalGrant {
  const store = loadStore();
  const grant: ApprovalGrant = {
    id: crypto.randomUUID(),
    tool: input.tool,
    scope: input.scope,
    scopeId: input.scopeId,
    paramsFingerprint: input.params ? paramsFingerprint(input.params) : undefined,
    grantedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + input.ttlMs).toISOString(),
    grantedBy: input.grantedBy,
  };
  store.grants.push(grant);
  appendAudit(store, {
    action: 'grant.add',
    tool: grant.tool,
    scope: grant.scope,
    scopeId: grant.scopeId,
    detail: grant.expiresAt,
  });
  saveStore(store);
  return grant;
}

export function revokeApprovalGrant(id: string): boolean {
  const store = loadStore();
  const before = store.grants.length;
  store.grants = store.grants.filter((g) => g.id !== id);
  if (store.grants.length === before) return false;
  appendAudit(store, { action: 'grant.revoke', detail: id });
  saveStore(store);
  return true;
}

export function pruneExpiredGrants(): number {
  const store = loadStore();
  const now = Date.now();
  const before = store.grants.length;
  store.grants = store.grants.filter((g) => new Date(g.expiresAt).getTime() > now);
  const removed = before - store.grants.length;
  if (removed > 0) saveStore(store);
  return removed;
}

function appendAudit(store: ApprovalStoreFile, entry: Omit<ApprovalAuditEntry, 'at'>): void {
  store.audit.push({ ...entry, at: new Date().toISOString() });
  if (store.audit.length > 500) {
    store.audit = store.audit.slice(-500);
  }
}

export function appendApprovalAudit(entry: Omit<ApprovalAuditEntry, 'at'>): void {
  const store = loadStore();
  appendAudit(store, entry);
  saveStore(store);
}

function scopeMatches(
  ruleScope: ApprovalScope,
  ruleScopeId: string | undefined,
  profile: string,
  sessionId: string,
): boolean {
  if (ruleScope === 'global') return true;
  if (ruleScope === 'profile') return ruleScopeId === profile;
  if (ruleScope === 'session') return ruleScopeId === sessionId;
  return false;
}

export function findBlockingRule(
  toolName: string,
  riskTier: ToolRiskTier,
  profile: string,
  sessionId: string,
): ApprovalRule | null {
  for (const rule of loadStore().rules) {
    if (rule.action !== 'block') continue;
    if (!scopeMatches(rule.scope, rule.scopeId, profile, sessionId)) continue;
    if (rule.tool && rule.tool !== toolName) continue;
    if (rule.riskTier && rule.riskTier !== riskTier) continue;
    return rule;
  }
  return null;
}

export function findAllowRule(
  toolName: string,
  riskTier: ToolRiskTier,
  profile: string,
  sessionId: string,
): ApprovalRule | null {
  for (const rule of loadStore().rules) {
    if (rule.action !== 'allow') continue;
    if (!scopeMatches(rule.scope, rule.scopeId, profile, sessionId)) continue;
    if (rule.tool && rule.tool !== toolName) continue;
    if (rule.riskTier && rule.riskTier !== riskTier) continue;
    return rule;
  }
  return null;
}

export function findActiveGrant(
  toolName: string,
  profile: string,
  sessionId: string,
  params?: Record<string, unknown>,
): ApprovalGrant | null {
  const now = Date.now();
  const fp = params ? paramsFingerprint(params) : undefined;
  for (const grant of loadStore().grants) {
    if (grant.tool !== toolName) continue;
    if (new Date(grant.expiresAt).getTime() <= now) continue;
    if (grant.scope === 'profile' && grant.scopeId !== profile) continue;
    if (grant.scope === 'session' && grant.scopeId !== sessionId) continue;
    if (grant.paramsFingerprint && fp && grant.paramsFingerprint !== fp) continue;
    return grant;
  }
  return null;
}
