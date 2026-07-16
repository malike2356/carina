import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearBehaviorClaims,
  extractClaimFromResult,
  recordClaimFromToolResult,
  resetBehaviorProofStoreForTests,
  scanTextForUnsupportedSuccessClaims,
  sha256Content,
  summarizeProofResults,
  verifyBehavior,
  verifyCommandExec,
  verifyFileWrite,
  verifyMessageSent,
  verifySessionBehavior,
  type AgentClaim,
} from './behavior-proof.js';

describe('behavior proof extraction', () => {
  it('extracts file write claims with path and hash evidence', () => {
    const claim = extractClaimFromResult(
      'file-write',
      { path: '/tmp/demo.txt', content: 'hello' },
      { path: '/tmp/demo.txt', bytes: 5 },
    );
    expect(claim?.type).toBe('file_write');
    expect(claim?.evidence.some((e) => e.type === 'file_exists')).toBe(true);
    expect(claim?.evidence.some((e) => e.type === 'file_content_hash')).toBe(true);
  });

  it('extracts command claims with exit code evidence', () => {
    const claim = extractClaimFromResult(
      'shell-exec',
      { command: 'echo ok', expect_output_contains: 'ok' },
      { stdout: 'ok\n', stderr: '', exitCode: 0 },
    );
    expect(claim?.type).toBe('command_exec');
    expect(claim?.evidence.find((e) => e.type === 'command_exit_code')?.value).toBe(0);
  });

  it('extracts message claims when delivery succeeded', () => {
    const claim = extractClaimFromResult(
      'send-message',
      { channel: 'telegram', conversation_id: '1', text: 'hi' },
      { sent: true, channel: 'telegram', conversation_id: '1' },
    );
    expect(claim?.type).toBe('message_sent');
  });

  it('skips error results', () => {
    expect(extractClaimFromResult('file-write', {}, { error: 'blocked' })).toBeNull();
  });
});

describe('behavior proof verification', () => {
  let tmpDir = '';

  afterEach(() => {
    resetBehaviorProofStoreForTests();
  });

  it('verifies file writes when file exists and hash matches', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-proof-'));
    const filePath = path.join(tmpDir, 'demo.txt');
    const content = 'proof me';
    await fs.writeFile(filePath, content, 'utf8');

    const claim: AgentClaim = {
      type: 'file_write',
      description: `Wrote file ${filePath}`,
      evidence: [
        { type: 'file_exists', value: filePath, verified: false },
        { type: 'file_content_hash', value: sha256Content(content), verified: false },
      ],
      timestamp: Date.now(),
    };

    const result = await verifyFileWrite(claim);
    expect(result.passed).toBe(true);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails file writes when file is missing', async () => {
    const claim: AgentClaim = {
      type: 'file_write',
      description: 'Wrote file /tmp/does-not-exist-carina-proof.txt',
      evidence: [{ type: 'file_exists', value: '/tmp/does-not-exist-carina-proof.txt', verified: false }],
      timestamp: Date.now(),
    };
    const result = await verifyFileWrite(claim);
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('does not exist');
  });

  it('verifies successful command execution', async () => {
    const claim: AgentClaim = {
      type: 'command_exec',
      description: 'Executed command echo ok',
      evidence: [
        { type: 'command_exit_code', value: 0, verified: false },
        { type: 'resource_state', value: { kind: 'stdout', text: 'ok' }, verified: false },
        { type: 'resource_state', value: { contains: 'ok' }, verified: false },
      ],
      timestamp: Date.now(),
    };
    const result = await verifyCommandExec(claim);
    expect(result.passed).toBe(true);
  });

  it('fails command execution with non-zero exit code', async () => {
    const claim: AgentClaim = {
      type: 'command_exec',
      description: 'Executed command false',
      evidence: [{ type: 'command_exit_code', value: 1, verified: false }],
      timestamp: Date.now(),
    };
    const result = await verifyCommandExec(claim);
    expect(result.passed).toBe(false);
  });

  it('verifies delivered messages', async () => {
    const claim: AgentClaim = {
      type: 'message_sent',
      description: 'Sent message via send-message',
      evidence: [{ type: 'message_delivery', value: { status: 'delivered' }, verified: false }],
      timestamp: Date.now(),
    };
    const result = await verifyMessageSent(claim);
    expect(result.passed).toBe(true);
  });

  it('runs batch verification', async () => {
    const results = await verifyBehavior([
      {
        type: 'command_exec',
        description: 'bad command',
        evidence: [{ type: 'command_exit_code', value: 2, verified: false }],
        timestamp: Date.now(),
      },
      {
        type: 'message_sent',
        description: 'good message',
        evidence: [{ type: 'message_delivery', value: { status: 'delivered' }, verified: false }],
        timestamp: Date.now(),
      },
    ]);
    expect(results).toHaveLength(2);
    expect(summarizeProofResults(results).failed).toBe(1);
    expect(summarizeProofResults(results).passed).toBe(1);
  });
});

describe('behavior proof session store', () => {
  afterEach(() => {
    resetBehaviorProofStoreForTests();
    clearBehaviorClaims('sess-proof');
  });

  it('records and verifies session claims end to end', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'behavior-proof-session-'));
    const filePath = path.join(tmpDir, 'out.txt');
    const content = 'stored claim';
    await fs.writeFile(filePath, content, 'utf8');

    recordClaimFromToolResult(
      'sess-proof',
      'file-write',
      { path: filePath, content },
      { path: filePath, bytes: content.length },
    );

    const results = await verifySessionBehavior('sess-proof');
    expect(results).toHaveLength(1);
    expect(results[0]?.passed).toBe(true);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});

describe('behavior proof CI scan', () => {
  it('flags unsupported success claims in prose', () => {
    const warnings = scanTextForUnsupportedSuccessClaims(
      'I wrote the config file and sent the email.\nTool output: exitCode 0',
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('unsupported success claim');
  });
});
