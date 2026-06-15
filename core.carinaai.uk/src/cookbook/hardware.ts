import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import type { GpuInfo, HardwareProfile } from './types.js';

let cachedProfile: HardwareProfile | null = null;

function runCommand(cmd: string, timeoutMs = 3000): string | null {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function parseNvidiaGpu(): GpuInfo | null {
  const out = runCommand('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits');
  if (!out) return null;
  const line = out.split('\n')[0]?.trim();
  if (!line) return null;
  const comma = line.lastIndexOf(',');
  if (comma < 0) return null;
  const model = line.slice(0, comma).trim();
  const vramMb = Number.parseFloat(line.slice(comma + 1).trim());
  if (!model || Number.isNaN(vramMb)) return null;
  return { vendor: 'NVIDIA', model, vramGb: Math.round((vramMb / 1024) * 10) / 10 };
}

function parseAmdGpu(): GpuInfo | null {
  const out = runCommand('rocm-smi --showmeminfo vram --csv');
  if (!out) return null;
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const header = lines[0]!.toLowerCase();
  const data = lines[1]!;
  const vramIdx = header.split(',').findIndex((h) => h.includes('vram'));
  const nameIdx = header.split(',').findIndex((h) => h.includes('card') || h.includes('gpu'));
  const cols = data.split(',');
  const vramRaw = vramIdx >= 0 ? cols[vramIdx] : cols[cols.length - 1];
  const vramMb = Number.parseFloat(String(vramRaw).replace(/[^\d.]/g, ''));
  const model = nameIdx >= 0 ? cols[nameIdx]?.trim() : 'AMD GPU';
  if (Number.isNaN(vramMb) || vramMb <= 0) return null;
  return { vendor: 'AMD', model: model || 'AMD GPU', vramGb: Math.round((vramMb / 1024) * 10) / 10 };
}

function parseMacGpu(): GpuInfo | null {
  const out = runCommand('system_profiler SPDisplaysDataType');
  if (!out) return null;
  const chip = out.match(/Chipset Model:\s*(.+)/i)?.[1]?.trim();
  const vramMatch = out.match(/VRAM \(.*\):\s*(\d+)\s*MB/i);
  if (!chip) return null;
  const vramGb = vramMatch ? Math.round((Number(vramMatch[1]) / 1024) * 10) / 10 : 0;
  const vendor = /apple|m[1-4]/i.test(chip) ? 'Apple' : 'Unknown';
  return { vendor, model: chip, vramGb };
}

function parseWindowsGpu(): GpuInfo | null {
  const out = runCommand('wmic path win32_VideoController get Name,AdapterRAM /format:csv');
  if (!out) return null;
  const lines = out.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('Node'));
  if (lines.length === 0) return null;
  const data = lines[0]!;
  const parts = data.split(',');
  const name = parts[parts.length - 2]?.trim();
  const ramRaw = parts[parts.length - 1]?.trim();
  const ramBytes = Number.parseInt(ramRaw ?? '', 10);
  if (!name) return null;
  const vramGb = Number.isFinite(ramBytes) && ramBytes > 0
    ? Math.round((ramBytes / (1024 ** 3)) * 10) / 10
    : 0;
  const vendor = /nvidia/i.test(name) ? 'NVIDIA' : /amd|radeon/i.test(name) ? 'AMD' : 'Unknown';
  return { vendor, model: name, vramGb };
}

function detectGpu(warnings: string[]): GpuInfo | null {
  const platform = os.platform();
  if (platform === 'darwin') {
    const gpu = parseMacGpu();
    if (!gpu) warnings.push('Could not detect GPU on macOS');
    return gpu;
  }
  if (platform === 'win32') {
    const gpu = parseWindowsGpu();
    if (!gpu) warnings.push('Could not detect GPU on Windows');
    return gpu;
  }
  const nvidia = parseNvidiaGpu();
  if (nvidia) return nvidia;
  const amd = parseAmdGpu();
  if (amd) return amd;
  warnings.push('No GPU detected (nvidia-smi and rocm-smi unavailable)');
  return null;
}

function detectDiskFreeGb(): number {
  try {
    const target = os.homedir() || process.cwd();
    const stats = fs.statfsSync(target);
    return Math.round(((stats.bfree * stats.bsize) / (1024 ** 3)) * 10) / 10;
  } catch {
    return 0;
  }
}

export function clearHardwareCache(): void {
  cachedProfile = null;
}

export function getHardwareProfile(force = false): HardwareProfile {
  if (cachedProfile && !force) return cachedProfile;

  const warnings: string[] = [];
  const totalRamBytes = os.totalmem();
  const ramGb = Math.round((totalRamBytes / (1024 ** 3)) * 10) / 10;
  const diskFreeGb = detectDiskFreeGb();
  if (diskFreeGb === 0) warnings.push('Could not read free disk space');

  const profile: HardwareProfile = {
    platform: os.platform(),
    cpuCores: os.cpus().length,
    ramGb,
    diskFreeGb,
    gpu: detectGpu(warnings),
    warnings,
  };

  cachedProfile = profile;
  return profile;
}

export function formatHardwareLine(profile: HardwareProfile): string {
  const gpuPart = profile.gpu
    ? `${profile.gpu.vendor} ${profile.gpu.model} ${profile.gpu.vramGb}GB VRAM`
    : 'No GPU detected';
  return `${gpuPart} | ${profile.ramGb}GB RAM | ${profile.diskFreeGb}GB free`;
}
