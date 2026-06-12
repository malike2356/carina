import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('workshop store', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-workshop-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_SKILL_WORKSHOP', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('queues and lists pending drafts', async () => {
    const { enqueueWorkshopDraft, listWorkshopDrafts, workshopReviewEnabled } =
      await import('./workshop-store.js');
    expect(workshopReviewEnabled()).toBe(true);
    enqueueWorkshopDraft({
      source: 'session-learner',
      name: 'demo-skill',
      description: 'Demo',
      trigger: ['deploy'],
      steps: '1. Do thing',
      toolsUsed: ['shell'],
    });
    expect(listWorkshopDrafts('pending')).toHaveLength(1);
  });

  it('rejects drafts without publishing', async () => {
    const { enqueueWorkshopDraft, rejectWorkshopDraft, listWorkshopDrafts } =
      await import('./workshop-store.js');
    const draft = enqueueWorkshopDraft({
      source: 'manual',
      name: 'x',
      description: 'x',
      trigger: [],
      steps: 'x',
      toolsUsed: [],
    });
    await rejectWorkshopDraft(draft.id);
    expect(listWorkshopDrafts('pending')).toHaveLength(0);
    expect(listWorkshopDrafts('rejected')).toHaveLength(1);
  });
});
