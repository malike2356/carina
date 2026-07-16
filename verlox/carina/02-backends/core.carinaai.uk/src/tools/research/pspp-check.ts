import { execFileSync } from 'node:child_process';

export interface PsppAvailability {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export function checkPspp(): PsppAvailability {
  try {
    const version = execFileSync('pspp', ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    const path = execFileSync('which', ['pspp'], {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    return { installed: true, version, path };
  } catch {
    return {
      installed: false,
      error: 'PSPP not installed. Run: sudo apt install pspp',
    };
  }
}
