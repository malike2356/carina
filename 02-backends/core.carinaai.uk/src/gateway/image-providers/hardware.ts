/** Minimum VRAM for Stable Diffusion class workflows (MB). */
export const SD_VRAM_MIN_MB = 6 * 1024;

/** Minimum VRAM for Flux class workflows (MB). */
export const FLUX_VRAM_MIN_MB = 12 * 1024;

export type GpuHardwareProfile = 'unknown' | 'insufficient' | 'sd_capable' | 'flux_capable';

export interface ComfyHardwareReport {
  reachable: boolean;
  vramMb: number | null;
  profile: GpuHardwareProfile;
  message: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

/** Parse ComfyUI /system_stats vram_total (bytes) into MB. */
export function vramMbFromSystemStats(stats: unknown): number | null {
  const root = asRecord(stats);
  if (!root) return null;

  const devices = Array.isArray(root.devices) ? root.devices : [];
  let maxBytes = 0;
  for (const device of devices) {
    const row = asRecord(device);
    const vram = Number(row?.vram_total ?? row?.vram_total_memory ?? 0);
    if (Number.isFinite(vram) && vram > maxBytes) maxBytes = vram;
  }
  if (maxBytes > 0) return Math.round(maxBytes / (1024 * 1024));

  const torchVram = Number(
    root.torch_vram_total
    ?? (asRecord(root.system)?.vram_total)
    ?? 0,
  );
  if (Number.isFinite(torchVram) && torchVram > 0) {
    return Math.round(torchVram / (1024 * 1024));
  }
  return null;
}

export function classifyVramProfile(vramMb: number | null): GpuHardwareProfile {
  if (vramMb === null) return 'unknown';
  if (vramMb >= FLUX_VRAM_MIN_MB) return 'flux_capable';
  if (vramMb >= SD_VRAM_MIN_MB) return 'sd_capable';
  return 'insufficient';
}

export function hardwareMessage(profile: GpuHardwareProfile, vramMb: number | null): string {
  const vramLabel = vramMb === null ? 'unknown VRAM' : `${vramMb} MB VRAM`;
  switch (profile) {
    case 'flux_capable':
      return `ComfyUI host reports ${vramLabel}; OK for SD and Flux workflows.`;
    case 'sd_capable':
      return `ComfyUI host reports ${vramLabel}; OK for SD/SDXL. Flux needs >= ${FLUX_VRAM_MIN_MB} MB.`;
    case 'insufficient':
      return `ComfyUI host reports ${vramLabel}; below ${SD_VRAM_MIN_MB} MB minimum for local SD.`;
    case 'unknown':
      return 'ComfyUI reachable but VRAM could not be read; prefer Fal/Replicate on CPU-only hosts.';
    default:
      return 'Hardware profile unknown.';
  }
}

export async function probeComfyUiHardware(
  baseUrl: string,
  timeoutMs = 5_000,
): Promise<ComfyHardwareReport> {
  const url = baseUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${url}/system_stats`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return {
        reachable: false,
        vramMb: null,
        profile: 'unknown',
        message: `ComfyUI system_stats returned ${res.status}`,
      };
    }
    const stats = await res.json();
    const vramMb = vramMbFromSystemStats(stats);
    const profile = classifyVramProfile(vramMb);
    return {
      reachable: true,
      vramMb,
      profile,
      message: hardwareMessage(profile, vramMb),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      reachable: false,
      vramMb: null,
      profile: 'unknown',
      message: `ComfyUI unreachable: ${msg}`,
    };
  }
}
