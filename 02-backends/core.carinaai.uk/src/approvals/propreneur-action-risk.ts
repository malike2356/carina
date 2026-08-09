import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveCarinaDataDir } from '../config/paths.js';

export const ACTION_RISK_CONTRACT_VERSION = '1.0.0';

export type ActionRiskClass =
  | 'read'
  | 'routine_write'
  | 'sensitive_pii'
  | 'destructive'
  | 'bulk'
  | 'financial'
  | 'legal'
  | 'access_control'
  | 'compliance'
  | 'external_communication';

export interface ActionRiskClassPolicy {
  description: string;
  default_approval: 'none' | 'propreneur_bridge_proposal' | 'explicit' | string;
  dual_control: boolean;
  dual_control_threshold?: number;
  dual_control_threshold_amount?: number;
  operator_pause_blocks: boolean;
  require_explicit_for?: string[];
}

export interface ActionRiskContract {
  contract: string;
  version: string;
  classes: Record<string, ActionRiskClassPolicy>;
  always_require_explicit_approval: string[];
  approval_digest: {
    algorithm: string;
    canonicalization: string;
    single_use: boolean;
    default_ttl_seconds: number;
    invalidate_on: string[];
  };
  audit: { mode: string; redact_keys: string[] };
}

function defaultRiskPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, '..', '..', 'contracts', 'propreneur-action-risk.v1.json');
}

let riskCache: ActionRiskContract | null = null;

export function resetActionRiskCache(): void {
  riskCache = null;
}

export function loadActionRiskContract(filePath?: string): ActionRiskContract {
  if (riskCache && !filePath) return riskCache;
  const raw = JSON.parse(fs.readFileSync(filePath ?? defaultRiskPath(), 'utf8')) as ActionRiskContract;
  if (raw.version !== ACTION_RISK_CONTRACT_VERSION) {
    throw new Error(
      `Incompatible propreneur-action-risk version ${raw.version}; expected ${ACTION_RISK_CONTRACT_VERSION}`,
    );
  }
  if (!filePath) riskCache = raw;
  return raw;
}

export function getRiskClassPolicy(riskClass: ActionRiskClass | string): ActionRiskClassPolicy {
  const contract = loadActionRiskContract();
  const policy = contract.classes[riskClass];
  if (!policy) {
    throw new Error(`Unknown action risk class: ${riskClass}`);
  }
  return policy;
}

export function requiresExplicitApproval(
  riskClass: ActionRiskClass | string,
  actionTags: string[] = [],
): boolean {
  const contract = loadActionRiskContract();
  const policy = getRiskClassPolicy(riskClass);
  if (policy.default_approval === 'explicit') return true;
  if (actionTags.some((t) => contract.always_require_explicit_approval.includes(t))) return true;
  if (policy.require_explicit_for?.some((t) => actionTags.includes(t))) return true;
  return false;
}

export function canonicalActionPayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const ordered: Record<string, unknown> = {};
  for (const key of keys) ordered[key] = payload[key];
  return JSON.stringify(ordered);
}

export function computeActionDigest(payload: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalActionPayload(payload)).digest('hex');
}

export interface BoundApproval {
  id: string;
  digest: string;
  riskClass: string;
  actorId: string;
  payload: Record<string, unknown>;
  resourceVersion: number | null;
  authFingerprint: string;
  expiresAt: string;
  used: boolean;
  invalidated: boolean;
  invalidatedReason: string | null;
  firstApproverId: string | null;
}

const approvals = new Map<string, BoundApproval>();

export function resetBoundApprovalsForTests(): void {
  approvals.clear();
}

export function createBoundApproval(input: {
  riskClass: ActionRiskClass | string;
  actorId: string;
  payload: Record<string, unknown>;
  resourceVersion?: number | null;
  authFingerprint: string;
  ttlSeconds?: number;
}): BoundApproval {
  const contract = loadActionRiskContract();
  const digest = computeActionDigest(input.payload);
  const ttl = input.ttlSeconds ?? contract.approval_digest.default_ttl_seconds;
  const row: BoundApproval = {
    id: randomUUID(),
    digest,
    riskClass: input.riskClass,
    actorId: input.actorId,
    payload: { ...input.payload },
    resourceVersion: input.resourceVersion ?? null,
    authFingerprint: input.authFingerprint,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    used: false,
    invalidated: false,
    invalidatedReason: null,
    firstApproverId: null,
  };
  approvals.set(row.id, row);
  return row;
}

export type ConsumeApprovalResult =
  | { ok: true; approval: BoundApproval }
  | { ok: false; reason: string };

export function consumeBoundApproval(input: {
  approvalId: string;
  payload: Record<string, unknown>;
  approverId: string;
  authFingerprint: string;
  resourceVersion?: number | null;
  dualControl?: boolean;
}): ConsumeApprovalResult {
  const approval = approvals.get(input.approvalId);
  if (!approval) return { ok: false, reason: 'not_found' };
  if (approval.invalidated) return { ok: false, reason: 'invalidated' };
  if (approval.used) return { ok: false, reason: 'already_used' };
  if (Date.parse(approval.expiresAt) < Date.now()) return { ok: false, reason: 'expired' };

  const digest = computeActionDigest(input.payload);
  if (digest !== approval.digest) return { ok: false, reason: 'digest_mismatch' };

  if (input.authFingerprint !== approval.authFingerprint) {
    approval.invalidated = true;
    approval.invalidatedReason = 'auth_change';
    return { ok: false, reason: 'auth_change' };
  }

  if (
    approval.resourceVersion !== null &&
    input.resourceVersion !== undefined &&
    input.resourceVersion !== null &&
    input.resourceVersion !== approval.resourceVersion
  ) {
    approval.invalidated = true;
    approval.invalidatedReason = 'version_change';
    return { ok: false, reason: 'version_change' };
  }

  const policy = getRiskClassPolicy(approval.riskClass);
  const needDual = input.dualControl ?? policy.dual_control;
  if (needDual) {
    if (!approval.firstApproverId) {
      if (input.approverId === approval.actorId) {
        return { ok: false, reason: 'dual_control_same_identity' };
      }
      approval.firstApproverId = input.approverId;
      return { ok: false, reason: 'dual_control_pending_second' };
    }
    if (input.approverId === approval.firstApproverId || input.approverId === approval.actorId) {
      return { ok: false, reason: 'dual_control_same_identity' };
    }
  }

  approval.used = true;
  return { ok: true, approval };
}

/** Operator pause: blocks mutations while allowing reads. */
let operatorPause = false;

export function setOperatorPause(paused: boolean): void {
  operatorPause = paused;
}

export function isOperatorPauseActive(): boolean {
  return operatorPause;
}

export function assertMutationAllowed(riskClass: ActionRiskClass | string): void {
  if (!operatorPause) return;
  const policy = getRiskClassPolicy(riskClass);
  if (policy.operator_pause_blocks) {
    throw new Error('Operator pause is active; mutations are blocked while reads remain available');
  }
}

const AUDIT_FILE = 'propreneur-aiva-audit.ndjson';

export function redactSecrets(
  value: unknown,
  redactKeys?: string[],
): unknown {
  const keys = new Set(
    (redactKeys ?? loadActionRiskContract().audit.redact_keys).map((k) => k.toLowerCase()),
  );
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, [...keys]));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = keys.has(k.toLowerCase()) ? '[REDACTED]' : redactSecrets(v, [...keys]);
    }
    return out;
  }
  return value;
}

export function appendAuditLog(entry: {
  action: string;
  riskClass?: string;
  actorId?: string;
  approvalId?: string;
  correlationId?: string;
  result?: string;
  details?: Record<string, unknown>;
}): void {
  const contract = loadActionRiskContract();
  const line = JSON.stringify({
    at: new Date().toISOString(),
    action: entry.action,
    risk_class: entry.riskClass ?? null,
    actor_id: entry.actorId ?? null,
    approval_id: entry.approvalId ?? null,
    correlation_id: entry.correlationId ?? null,
    result: entry.result ?? null,
    details: redactSecrets(entry.details ?? {}, contract.audit.redact_keys),
  });
  const dir = resolveCarinaDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, AUDIT_FILE), `${line}\n`);
}
