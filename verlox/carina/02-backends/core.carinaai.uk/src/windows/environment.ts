import fs from 'node:fs';
import path from 'node:path';
import { execFile, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { globalCarinaHome } from '../config/paths.js';

const execFileAsync = promisify(execFile);

export type WindowsPrereqReport = {
  platform: string;
  isWindows: boolean;
  buildNumber: number | null;
  conptySupported: boolean;
  nodeVersion: string | null;
  nodeMajor: number | null;
  nodeOk: boolean;
  carinaHome: string;
  carinaEnvExists: boolean;
  carinaOnPath: boolean;
  powershellAvailable: boolean;
  issues: string[];
};

function readWindowsBuildNumber(): number | null {
  if (process.platform !== 'win32') return null;
  try {
    const key = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion';
    const stdout = execSync(`reg query "${key}" /v CurrentBuildNumber`, {
      encoding: 'utf8',
      windowsHide: true,
    });
    const match = stdout.match(/CurrentBuildNumber\s+REG_SZ\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

export function isWindowsPlatform(platform = process.platform): boolean {
  return platform === 'win32';
}

export function windowsConptySupported(buildNumber: number | null): boolean {
  if (buildNumber == null) return true;
  return buildNumber >= 17763;
}

export function parseNodeMajor(version: string | null): number | null {
  if (!version) return null;
  const match = version.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function detectWindowsPrereqs(): Promise<WindowsPrereqReport> {
  const issues: string[] = [];
  const isWindows = isWindowsPlatform();
  const buildNumber = isWindows ? readWindowsBuildNumber() : null;
  const conptySupported = windowsConptySupported(buildNumber);
  if (isWindows && !conptySupported) {
    issues.push('Windows 10 1809 (build 17763) or later is required for PTY support');
  }

  let nodeVersion: string | null = null;
  try {
    const { stdout } = await execFileAsync('node', ['--version'], { windowsHide: true });
    nodeVersion = stdout.trim();
  } catch {
    issues.push('Node.js is not installed or not on PATH');
  }
  const nodeMajor = parseNodeMajor(nodeVersion);
  const nodeOk = nodeMajor != null && nodeMajor >= 22;
  if (nodeVersion && !nodeOk) {
    issues.push(`Node.js 22+ required (found ${nodeVersion})`);
  }

  const carinaHome = globalCarinaHome();
  const carinaEnvExists = fs.existsSync(path.join(carinaHome, '.env'));

  let carinaOnPath = false;
  try {
    if (isWindows) {
      await execFileAsync('where', ['carina'], { windowsHide: true });
      carinaOnPath = true;
    } else {
      await execFileAsync('which', ['carina']);
      carinaOnPath = true;
    }
  } catch {
    issues.push('carina CLI is not on PATH');
  }

  let powershellAvailable = false;
  if (isWindows) {
    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-Command', 'exit 0'], { windowsHide: true });
      powershellAvailable = true;
    } catch {
      issues.push('PowerShell is not available');
    }
  }

  return {
    platform: process.platform,
    isWindows,
    buildNumber,
    conptySupported,
    nodeVersion,
    nodeMajor,
    nodeOk,
    carinaHome,
    carinaEnvExists,
    carinaOnPath,
    powershellAvailable,
    issues,
  };
}

export function defaultWindowsInstallHint(): string {
  return [
    'Windows quick install:',
    '  powershell -ExecutionPolicy Bypass -File installer/install-windows.ps1',
    'Or download carina-setup.exe from the latest GitHub release.',
    'Recovery: carina doctor; carina update check; see docs/WINDOWS.md',
  ].join('\n');
}
