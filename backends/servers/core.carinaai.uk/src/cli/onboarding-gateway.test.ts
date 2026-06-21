import { describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  printChannelSetupGuide,
  printGatewayNextSteps,
  printRoutingCheatSheet,
  runGatewayOnboardingStep,
} from './onboarding-gateway.js';

describe('onboarding-gateway', () => {
  it('prints telegram env hints', () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      logs.push(String(msg));
    });
    printChannelSetupGuide('telegram');
    spy.mockRestore();
    expect(logs.join('\n')).toContain('TELEGRAM_BOT_TOKEN');
    expect(logs.join('\n')).toContain('carina channels setup telegram');
  });

  it('skips channel guide when user chooses skip', () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      logs.push(String(msg));
    });
    printChannelSetupGuide('skip');
    spy.mockRestore();
    expect(logs).toHaveLength(0);
  });

  it('prints routing cheat sheet with test commands', () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      logs.push(String(msg));
    });
    printRoutingCheatSheet();
    spy.mockRestore();
    expect(logs.join('\n')).toContain('carina agents route');
    expect(logs.join('\n')).toContain('carina agents bind add');
  });

  it('prints gateway next steps with web port', () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      logs.push(String(msg));
    });
    printGatewayNextSteps({ channel: 'web', daemonInstalled: true, webPort: '3333' });
    spy.mockRestore();
    expect(logs.join('\n')).toContain('http://localhost:3333');
    expect(logs.join('\n')).toContain('remote-access.md');
  });

  it('runs gateway onboarding without daemon when declined', async () => {
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-gw-onboard-'));
    process.env.CARINA_HOME = tmpHome;

    const confirm = vi.fn().mockResolvedValue(false);
    const select = vi.fn().mockResolvedValue('skip');

    try {
      const result = await runGatewayOnboardingStep({ confirm, select });
      expect(result.daemonInstalled).toBe(false);
      expect(result.channel).toBe('skip');
      expect(confirm).toHaveBeenCalledOnce();
      expect(select).toHaveBeenCalledOnce();
    } finally {
      await fs.rm(tmpHome, { recursive: true, force: true });
      delete process.env.CARINA_HOME;
    }
  });
});
