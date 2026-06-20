import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let dockerAvailable: boolean | null = null;

export async function checkDocker(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    await execAsync('docker info', { timeout: 5000 });
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }
  return dockerAvailable;
}

export function isDockerAvailable(): boolean {
  return dockerAvailable === true;
}

export function resetDockerCheck(): void {
  dockerAvailable = null;
}
