import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { getToolExecutionContext, toolExecutionContext } from './tool-execution-context.js';

/**
 * Behavior proof: verify that the agent actually did what it claimed.
 * Principle: distrust claims until tool output and filesystem state match.
 */

export type AgentClaimType =
  | 'file_write'
  | 'file_read'
  | 'command_exec'
  | 'api_call'
  | 'message_sent'
  | 'resource_created'
  | 'resource_deleted';

export type EvidenceType =
  | 'file_exists'
  | 'file_content_hash'
  | 'command_exit_code'
  | 'api_response'
  | 'message_delivery'
  | 'resource_state';

export interface EvidenceItem {
  type: EvidenceType;
  value: unknown;
  verified: boolean;
}

export interface AgentClaim {
  type: AgentClaimType;
  description: string;
  evidence: EvidenceItem[];
  timestamp: number;
  toolName?: string;
  sessionId?: string;
}

export interface ProofResult {
  claim: AgentClaim;
  passed: boolean;
  failures: string[];
  verifiedAt: number;
}

const claimsBySession = new Map<string, AgentClaim[]>();

const FILE_WRITE_TOOLS = new Set(['file-write', 'patch']);
const FILE_READ_TOOLS = new Set(['file-read']);
const COMMAND_TOOLS = new Set(['shell-exec', 'code-exec']);
const MESSAGE_TOOLS = new Set(['email-send', 'email-smtp-send', 'send-message']);
const API_TOOLS = new Set(['http-request']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isErrorResult(result: unknown): boolean {
  if (typeof result === 'string') {
    return result.startsWith('Error') || result.startsWith('error:');
  }
  if (isRecord(result) && typeof result.error === 'string') return true;
  return false;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function sha256Content(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function sha256File(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractPath(params: Record<string, unknown>, result: unknown): string | null {
  if (isRecord(result)) {
    const fromResult = pickString(result.path, result.file);
    if (fromResult) return path.resolve(fromResult);
  }
  const fromParams = pickString(params.path, params.file);
  return fromParams ? path.resolve(fromParams) : null;
}

function extractContentHash(params: Record<string, unknown>, result: unknown): string | null {
  if (isRecord(result)) {
    const hash = pickString(result.contentHash, result.sha256);
    if (hash) return hash;
  }
  const content = pickString(params.content);
  return content ? sha256Content(content) : null;
}

function extractExitCode(evidence: EvidenceItem[]): number | null {
  const item = evidence.find((e) => e.type === 'command_exit_code');
  if (item && typeof item.value === 'number') return item.value;
  return null;
}

function extractOutputAssertion(claim: AgentClaim): { matches: (output: string) => boolean; describe: () => string } | null {
  const item = claim.evidence.find((e) => e.type === 'resource_state' && isRecord(e.value));
  if (!item || !isRecord(item.value)) return null;
  const contains = pickString(item.value.contains);
  if (!contains) return null;
  return {
    matches: (output: string) => output.includes(contains),
    describe: () => `output must contain "${contains}"`,
  };
}

function extractToolOutput(evidence: EvidenceItem[]): string {
  const stdout = evidence.find((e) => e.type === 'resource_state' && isRecord(e.value) && e.value.kind === 'stdout');
  if (stdout && isRecord(stdout.value) && typeof stdout.value.text === 'string') {
    return stdout.value.text;
  }
  return '';
}

function extractDeliveryConfirmation(evidence: EvidenceItem[]): { status: string } | null {
  const item = evidence.find((e) => e.type === 'message_delivery');
  if (!item || !isRecord(item.value)) return null;
  const status = pickString(item.value.status) ?? 'unknown';
  return { status };
}

function extractApiStatus(evidence: EvidenceItem[]): number | null {
  const item = evidence.find((e) => e.type === 'api_response');
  if (!item || !isRecord(item.value)) return null;
  const status = item.value.status;
  return typeof status === 'number' ? status : null;
}

function buildEvidenceFromResult(
  toolName: string,
  params: Record<string, unknown>,
  result: unknown,
): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  if (FILE_WRITE_TOOLS.has(toolName) || FILE_READ_TOOLS.has(toolName)) {
    const filePath = extractPath(params, result);
    if (filePath) {
      evidence.push({ type: 'file_exists', value: filePath, verified: false });
    }
    const hash = extractContentHash(params, result);
    if (hash) {
      evidence.push({ type: 'file_content_hash', value: hash, verified: false });
    }
  }

  if (COMMAND_TOOLS.has(toolName) && isRecord(result)) {
    if (typeof result.exitCode === 'number') {
      evidence.push({ type: 'command_exit_code', value: result.exitCode, verified: false });
    }
    if (typeof result.stdout === 'string') {
      evidence.push({
        type: 'resource_state',
        value: { kind: 'stdout', text: result.stdout },
        verified: false,
      });
    }
    const contains = pickString(params.expect_output_contains);
    if (contains) {
      evidence.push({
        type: 'resource_state',
        value: { contains },
        verified: false,
      });
    }
  }

  if (API_TOOLS.has(toolName) && isRecord(result) && typeof result.status === 'number') {
    evidence.push({
      type: 'api_response',
      value: { status: result.status, ok: result.status >= 200 && result.status < 300 },
      verified: false,
    });
  }

  if (MESSAGE_TOOLS.has(toolName) && isRecord(result)) {
    const sent = result.sent === true || pickString(result.id, result.message)?.includes('sent');
    evidence.push({
      type: 'message_delivery',
      value: { status: sent ? 'delivered' : 'failed', raw: result },
      verified: false,
    });
  }

  return evidence;
}

export function extractClaimFromResult(
  toolName: string,
  params: Record<string, unknown>,
  result: unknown,
): AgentClaim | null {
  if (isErrorResult(result)) return null;

  let type: AgentClaimType | null = null;
  let description = '';

  if (FILE_WRITE_TOOLS.has(toolName)) {
    type = 'file_write';
    description = `Wrote file ${extractPath(params, result) ?? '(unknown path)'}`;
  } else if (FILE_READ_TOOLS.has(toolName)) {
    type = 'file_read';
    description = `Read file ${extractPath(params, result) ?? '(unknown path)'}`;
  } else if (COMMAND_TOOLS.has(toolName)) {
    type = 'command_exec';
    description = `Executed command ${pickString(params.command) ?? toolName}`;
  } else if (API_TOOLS.has(toolName)) {
    type = 'api_call';
    description = `API call ${pickString(params.method, 'GET')} ${pickString(params.url) ?? ''}`.trim();
  } else if (MESSAGE_TOOLS.has(toolName)) {
    type = 'message_sent';
    description = `Sent message via ${toolName}`;
  }

  if (!type) return null;

  return {
    type,
    description,
    evidence: buildEvidenceFromResult(toolName, params, result),
    timestamp: Date.now(),
    toolName,
  };
}

export async function verifyFileWrite(claim: AgentClaim): Promise<ProofResult> {
  const failures: string[] = [];
  const pathItem = claim.evidence.find((e) => e.type === 'file_exists');
  const filePath = pathItem && typeof pathItem.value === 'string' ? pathItem.value : null;

  if (!filePath) {
    return {
      claim,
      passed: false,
      failures: ['Could not extract file path from claim evidence'],
      verifiedAt: Date.now(),
    };
  }

  const exists = await fileExists(filePath);
  if (!exists) failures.push(`File does not exist: ${filePath}`);

  const hashItem = claim.evidence.find((e) => e.type === 'file_content_hash');
  if (hashItem && typeof hashItem.value === 'string' && exists) {
    const actualHash = await sha256File(filePath);
    if (actualHash !== hashItem.value) {
      failures.push(`Content hash mismatch. Expected: ${hashItem.value}, Actual: ${actualHash}`);
    }
  }

  return {
    claim,
    passed: failures.length === 0,
    failures,
    verifiedAt: Date.now(),
  };
}

export async function verifyFileRead(claim: AgentClaim): Promise<ProofResult> {
  const pathItem = claim.evidence.find((e) => e.type === 'file_exists');
  const filePath = pathItem && typeof pathItem.value === 'string' ? pathItem.value : null;
  if (!filePath) {
    return {
      claim,
      passed: false,
      failures: ['Could not extract file path from claim evidence'],
      verifiedAt: Date.now(),
    };
  }
  const exists = await fileExists(filePath);
  return {
    claim,
    passed: exists,
    failures: exists ? [] : [`File does not exist: ${filePath}`],
    verifiedAt: Date.now(),
  };
}

export async function verifyCommandExec(claim: AgentClaim): Promise<ProofResult> {
  const failures: string[] = [];
  const exitCode = extractExitCode(claim.evidence);
  if (exitCode === null) {
    failures.push('No exit code in tool evidence');
  } else if (exitCode !== 0) {
    failures.push(`Command exited with code ${exitCode}`);
  }

  const assertion = extractOutputAssertion(claim);
  if (assertion) {
    const actualOutput = extractToolOutput(claim.evidence);
    if (!assertion.matches(actualOutput)) {
      failures.push(`Output assertion failed: ${assertion.describe()}`);
    }
  }

  return {
    claim,
    passed: failures.length === 0,
    failures,
    verifiedAt: Date.now(),
  };
}

export async function verifyMessageSent(claim: AgentClaim): Promise<ProofResult> {
  const failures: string[] = [];
  const delivery = extractDeliveryConfirmation(claim.evidence);
  if (!delivery) {
    failures.push('No delivery confirmation in tool output');
  } else if (delivery.status !== 'delivered') {
    failures.push(`Message status: ${delivery.status}, expected: delivered`);
  }

  return {
    claim,
    passed: failures.length === 0,
    failures,
    verifiedAt: Date.now(),
  };
}

export async function verifyApiCall(claim: AgentClaim): Promise<ProofResult> {
  const failures: string[] = [];
  const status = extractApiStatus(claim.evidence);
  if (status === null) {
    failures.push('No API response status in tool evidence');
  } else if (status < 200 || status >= 300) {
    failures.push(`API response status ${status}, expected 2xx`);
  }

  return {
    claim,
    passed: failures.length === 0,
    failures,
    verifiedAt: Date.now(),
  };
}

export async function verifyClaim(claim: AgentClaim): Promise<ProofResult> {
  switch (claim.type) {
    case 'file_write':
      return verifyFileWrite(claim);
    case 'file_read':
      return verifyFileRead(claim);
    case 'command_exec':
      return verifyCommandExec(claim);
    case 'message_sent':
      return verifyMessageSent(claim);
    case 'api_call':
      return verifyApiCall(claim);
    default:
      return {
        claim,
        passed: false,
        failures: [`Unsupported claim type for verification: ${claim.type}`],
        verifiedAt: Date.now(),
      };
  }
}

export async function verifyBehavior(claims: AgentClaim[]): Promise<ProofResult[]> {
  const results: ProofResult[] = [];
  for (const claim of claims) {
    const result = await verifyClaim(claim);
    results.push(result);
    if (!result.passed && process.env.CARINA_BEHAVIOR_PROOF_LOG !== 'false') {
      console.warn('[behavior-proof] verification failed', {
        claimType: claim.type,
        description: claim.description,
        failures: result.failures,
      });
    }
  }
  return results;
}

export function recordBehaviorClaim(sessionId: string, claim: AgentClaim): void {
  const tagged = { ...claim, sessionId };
  const list = claimsBySession.get(sessionId) ?? [];
  list.push(tagged);
  claimsBySession.set(sessionId, list);

  const store = toolExecutionContext.getStore();
  if (store) {
    if (!store.claims) store.claims = [];
    store.claims.push(tagged);
  }
}

export function getBehaviorClaims(sessionId?: string): AgentClaim[] {
  if (sessionId) return [...(claimsBySession.get(sessionId) ?? [])];
  const ctx = getToolExecutionContext();
  return ctx.claims ? [...ctx.claims] : [];
}

export function clearBehaviorClaims(sessionId?: string): void {
  if (sessionId) {
    claimsBySession.delete(sessionId);
    return;
  }
  claimsBySession.clear();
  const store = toolExecutionContext.getStore();
  if (store) store.claims = [];
}

export function recordClaimFromToolResult(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
  result: unknown,
): AgentClaim | null {
  const claim = extractClaimFromResult(toolName, params, result);
  if (!claim) return null;
  recordBehaviorClaim(sessionId, claim);
  return claim;
}

export async function verifySessionBehavior(sessionId: string): Promise<ProofResult[]> {
  return verifyBehavior(getBehaviorClaims(sessionId));
}

export function summarizeProofResults(results: ProofResult[]): {
  passed: number;
  failed: number;
  failures: string[];
} {
  const failures = results.filter((r) => !r.passed).flatMap((r) => r.failures);
  return {
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    failures,
  };
}

export function resetBehaviorProofStoreForTests(): void {
  claimsBySession.clear();
}

/** Optional PR/commit claim scan for CI (plain-text heuristics). */
export function scanTextForUnsupportedSuccessClaims(text: string): string[] {
  const warnings: string[] = [];
  const lines = text.split('\n');
  const successPatterns = [
    /\b(i|we)\s+(wrote|created|sent|deployed|fixed|implemented)\b/i,
    /\b(file|email|message)\s+(was\s+)?(written|sent|created)\b/i,
    /\bcommand\s+(ran|executed)\s+successfully\b/i,
  ];
  const evidencePatterns = [
    /sha-?256/i,
    /exit code/i,
    /exitCode/i,
    /delivered/i,
    /tool output/i,
    /```/,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!successPatterns.some((p) => p.test(trimmed))) continue;
    if (evidencePatterns.some((p) => p.test(trimmed))) continue;
    warnings.push(`Possible unsupported success claim without evidence: ${trimmed.slice(0, 120)}`);
  }

  return warnings;
}
