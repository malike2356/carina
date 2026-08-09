import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  emailIngestionPilotWorkspaceIds,
  isEmailIngestionActive,
  isEmailIngestionEnabled,
  isEmailIngestionEnabledForWorkspace,
  resetEmailIngestionPilotCache,
} from './aiva-feature-flags.js';

describe('aiva feature flags', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
    resetEmailIngestionPilotCache();
    delete process.env.CARINA_HOME;
  });

  it('enables ingestion globally when EMAIL_INGESTION_ENABLED=true', () => {
    process.env.EMAIL_INGESTION_ENABLED = 'true';
    delete process.env.EMAIL_INGESTION_PILOT_WORKSPACE_IDS;
    resetEmailIngestionPilotCache();
    expect(isEmailIngestionEnabled()).toBe(true);
    expect(isEmailIngestionActive()).toBe(true);
    expect(isEmailIngestionEnabledForWorkspace('any-workspace')).toBe(true);
  });

  it('limits ingestion to pilot workspace IDs when global flag is off', () => {
    process.env.EMAIL_INGESTION_ENABLED = 'false';
    process.env.EMAIL_INGESTION_PILOT_WORKSPACE_IDS = 'Ws-1, ws-2 ';
    resetEmailIngestionPilotCache();
    expect(isEmailIngestionEnabled()).toBe(false);
    expect(isEmailIngestionActive()).toBe(true);
    expect(emailIngestionPilotWorkspaceIds()).toEqual(new Set(['ws-1', 'ws-2']));
    expect(isEmailIngestionEnabledForWorkspace('ws-1')).toBe(true);
    expect(isEmailIngestionEnabledForWorkspace('ws-3')).toBe(false);
  });

  it('is inactive when global flag is off and pilot list is empty', () => {
    process.env.EMAIL_INGESTION_ENABLED = 'false';
    delete process.env.EMAIL_INGESTION_PILOT_WORKSPACE_IDS;
    resetEmailIngestionPilotCache();
    expect(isEmailIngestionActive()).toBe(false);
    expect(isEmailIngestionEnabledForWorkspace('ws-1')).toBe(false);
  });

  it('enables ingestion for a workspace when tenant config gate is on', () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-email-gate-'));
    process.env.CARINA_HOME = tmpHome;
    process.env.EMAIL_INGESTION_ENABLED = 'false';
    delete process.env.EMAIL_INGESTION_PILOT_WORKSPACE_IDS;
    fs.mkdirSync(path.join(tmpHome, 'tenant-config'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpHome, 'tenant-config', 'ws-tenant.json'),
      JSON.stringify({ tenantId: 'ws-tenant', emailIngestionEnabled: true }, null, 2),
      'utf-8',
    );
    resetEmailIngestionPilotCache();
    expect(isEmailIngestionActive()).toBe(true);
    expect(isEmailIngestionEnabledForWorkspace('ws-tenant')).toBe(true);
    expect(isEmailIngestionEnabledForWorkspace('ws-other')).toBe(false);
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });
});
