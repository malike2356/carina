import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../workers/worker-store.js', () => ({
  getWorkerById: vi.fn(),
  updateWorker: vi.fn(),
}));

vi.mock('../../ingestion/social/social-settings-store.js', () => ({
  getSocialSettings: vi.fn(async () => ({
    socialRequireApproval: false,
    socialAutoReplyEnabled: false,
    socialAutoReplyAllowlist: ['thanks'],
  })),
}));

vi.mock('../../memory/store.js', () => ({
  clearSession: vi.fn(async () => undefined),
}));

vi.mock('../../brain/prompt-cache.js', () => ({
  forceImmediateInvalidation: vi.fn(),
}));

import { getWorkerById, updateWorker } from '../../workers/worker-store.js';
import {
  configCommand,
  incognitoCommand,
  incognitoOffCommand,
  incognitoOnCommand,
  voiceCommand,
  voiceOffCommand,
  voiceOnCommand,
} from './config-commands.js';
import type { InboundMessage } from '../types.js';

const getWorkerByIdMock = vi.mocked(getWorkerById);
const updateWorkerMock = vi.mocked(updateWorker);

function msg(content: string): InboundMessage {
  return {
    channel: 'telegram',
    workerId: '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
    workspaceId: '6262da46-3121-4aa1-8987-b74c099f62ad',
    contactId: '123',
    content,
    rawPayload: {},
    timestamp: new Date(),
  };
}

describe('voice and config slash commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkerByIdMock.mockResolvedValue({
      id: '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      workspaceId: '6262da46-3121-4aa1-8987-b74c099f62ad',
      name: 'Randy',
      status: 'active',
      workerConfig: { telegram: { preferVoiceReplies: false } },
    } as never);
    updateWorkerMock.mockImplementation(async (_ws, _id, patch) => ({
      id: '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      workspaceId: '6262da46-3121-4aa1-8987-b74c099f62ad',
      name: 'Randy',
      status: 'active',
      workerConfig: patch.workerConfig,
    } as never));
  });

  it('/voice reports current setting', async () => {
    const reply = await voiceCommand.handler(msg('/voice'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Prefer voice replies: off');
    expect(reply).toContain('/voice_on');
    expect(reply).toContain('/voice_off');
  });

  it('/voice on updates worker config', async () => {
    const reply = await voiceCommand.handler(msg('/voice on'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Prefer voice replies: on');
    expect(updateWorkerMock).toHaveBeenCalledWith(
      '6262da46-3121-4aa1-8987-b74c099f62ad',
      '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      expect.objectContaining({
        workerConfig: expect.objectContaining({
          telegram: expect.objectContaining({ preferVoiceReplies: true }),
        }),
      }),
    );
  });

  it('/voice off updates worker config', async () => {
    getWorkerByIdMock.mockResolvedValue({
      id: '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      workspaceId: '6262da46-3121-4aa1-8987-b74c099f62ad',
      name: 'Randy',
      status: 'active',
      workerConfig: { telegram: { preferVoiceReplies: true } },
    } as never);
    const reply = await voiceCommand.handler(msg('/voice off'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Prefer voice replies: off');
  });

  it('/voice_on turns preference on', async () => {
    const reply = await voiceOnCommand.handler(msg('/voice_on'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Prefer voice replies: on');
    expect(updateWorkerMock).toHaveBeenCalledWith(
      '6262da46-3121-4aa1-8987-b74c099f62ad',
      '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      expect.objectContaining({
        workerConfig: expect.objectContaining({
          telegram: expect.objectContaining({ preferVoiceReplies: true }),
        }),
      }),
    );
  });

  it('/voice_off turns preference off', async () => {
    getWorkerByIdMock.mockResolvedValue({
      id: '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      workspaceId: '6262da46-3121-4aa1-8987-b74c099f62ad',
      name: 'Randy',
      status: 'active',
      workerConfig: { telegram: { preferVoiceReplies: true } },
    } as never);
    const reply = await voiceOffCommand.handler(msg('/voice_off'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Prefer voice replies: off');
  });

  it('/incognito_on turns privacy on', async () => {
    const reply = await incognitoOnCommand.handler(msg('/incognito_on'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Incognito: on');
    expect(updateWorkerMock).toHaveBeenCalledWith(
      '6262da46-3121-4aa1-8987-b74c099f62ad',
      '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      expect.objectContaining({
        workerConfig: expect.objectContaining({
          privacy: expect.objectContaining({ incognito: true }),
        }),
      }),
    );
  });

  it('/incognito_off turns privacy off', async () => {
    getWorkerByIdMock.mockResolvedValue({
      id: '2b67ef6f-c4b4-43cb-a5b1-87a06720f026',
      workspaceId: '6262da46-3121-4aa1-8987-b74c099f62ad',
      name: 'Randy',
      status: 'active',
      workerConfig: { privacy: { incognito: true } },
    } as never);
    const reply = await incognitoOffCommand.handler(msg('/incognito_off'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Incognito: off');
  });

  it('/incognito reports status', async () => {
    const reply = await incognitoCommand.handler(msg('/incognito'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Incognito: off');
    expect(reply).toContain('/incognito_on');
  });

  it('/config lists toggles including incognito', async () => {
    const reply = await configCommand.handler(msg('/config'), '2b67ef6f-c4b4-43cb-a5b1-87a06720f026');
    expect(reply).toContain('Config for Randy:');
    expect(reply).toContain('Prefer voice replies: off');
    expect(reply).toContain('Incognito: off');
    expect(reply).toContain('Social require approval: off');
  });
});
