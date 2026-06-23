import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const WINDOWS_GATEWAY_TASK = 'CarinaGateway';

export function windowsGatewayTaskCommand(execStart = 'carina serve'): string {
  const cmd = execStart.trim().startsWith('carina ')
    ? execStart.trim()
    : `carina ${execStart.trim()}`;
  return `cmd.exe /c ${cmd}`;
}

export function windowsSupervisorTaskCommand(): string {
  return 'cmd.exe /c carina host supervise';
}

export async function isWindowsGatewayTaskInstalled(
  taskName = WINDOWS_GATEWAY_TASK,
): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execFileAsync('schtasks', ['/Query', '/TN', taskName, '/FO', 'LIST'], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function installWindowsGatewayTask(options: {
  execStart?: string;
  taskName?: string;
  onLogon?: boolean;
} = {}): Promise<{ taskName: string; command: string }> {
  if (process.platform !== 'win32') {
    throw new Error('Windows scheduled tasks are only supported on win32');
  }
  const taskName = options.taskName ?? WINDOWS_GATEWAY_TASK;
  const command = options.onLogon === false
    ? windowsSupervisorTaskCommand()
    : windowsGatewayTaskCommand(options.execStart ?? 'carina serve');
  const schedule = options.onLogon === false ? 'ONSTART' : 'ONLOGON';

  await execFileAsync('schtasks', [
    '/Create',
    '/TN', taskName,
    '/TR', command,
    '/SC', schedule,
    '/RL', 'LIMITED',
    '/F',
  ], { windowsHide: true });

  return { taskName, command };
}

export async function uninstallWindowsGatewayTask(
  taskName = WINDOWS_GATEWAY_TASK,
): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execFileAsync('schtasks', ['/Delete', '/TN', taskName, '/F'], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function runWindowsGatewayTask(taskName = WINDOWS_GATEWAY_TASK): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execFileAsync('schtasks', ['/Run', '/TN', taskName], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function stopWindowsGatewayTask(taskName = WINDOWS_GATEWAY_TASK): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execFileAsync('schtasks', ['/End', '/TN', taskName], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function queryWindowsGatewayTask(
  taskName = WINDOWS_GATEWAY_TASK,
): Promise<Record<string, string>> {
  if (process.platform !== 'win32') return {};
  try {
    const { stdout } = await execFileAsync(
      'schtasks',
      ['/Query', '/TN', taskName, '/FO', 'LIST', '/V'],
      { windowsHide: true },
    );
    const fields: Record<string, string> = {};
    for (const line of stdout.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) fields[key] = value;
    }
    return fields;
  } catch {
    return {};
  }
}
