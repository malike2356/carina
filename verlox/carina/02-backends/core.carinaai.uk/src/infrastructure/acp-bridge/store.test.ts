import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('acp-bridge store', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-acp-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('creates sessions with label and provenance', async () => {
    const { createAcpSession, listAcpSessions, setAcpSessionLabel } = await import('./store.js');
    const s = createAcpSession({ label: 'vscode', provenance: 'acp-ide' });
    expect(s.label).toBe('vscode');
    expect(listAcpSessions()).toHaveLength(1);
    setAcpSessionLabel(s.sessionId, 'renamed');
    expect(listAcpSessions()[0]?.label).toBe('renamed');
  });

  it('is disabled unless CARINA_ACP_ENABLED', async () => {
    const { acpBridgeEnabled } = await import('./store.js');
    expect(acpBridgeEnabled()).toBe(false);
    vi.stubEnv('CARINA_ACP_ENABLED', 'true');
    expect(acpBridgeEnabled()).toBe(true);
  });
});
