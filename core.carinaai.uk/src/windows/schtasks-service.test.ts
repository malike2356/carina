import { describe, expect, it } from 'vitest';
import {
  WINDOWS_GATEWAY_TASK,
  windowsGatewayTaskCommand,
  windowsSupervisorTaskCommand,
} from './schtasks-service.js';

describe('windows schtasks service', () => {
  it('builds gateway task command', () => {
    expect(windowsGatewayTaskCommand('carina serve')).toContain('carina serve');
    expect(windowsSupervisorTaskCommand()).toContain('carina host supervise');
  });

  it('uses stable task name', () => {
    expect(WINDOWS_GATEWAY_TASK).toBe('CarinaGateway');
  });

  it('rejects install on non-Windows', async () => {
    if (process.platform === 'win32') return;
    const mod = await import('./schtasks-service.js');
    await expect(mod.installWindowsGatewayTask()).rejects.toThrow(/win32/);
  });
});
