import { getCatalog } from './catalog.js';
import type { CatalogEntry, HardwareProfile, HardwareTier, Recommendation } from './types.js';

const VRAM_HEADROOM = 0.85;
const RAM_HEADROOM = 0.7;

export function resolveTier(profile: HardwareProfile): HardwareTier {
  const vram = profile.gpu?.vramGb ?? 0;
  if (vram <= 0) return 'cpu-only';
  if (vram <= 6) return 'low-vram';
  if (vram <= 16) return 'mid-vram';
  return 'high-vram';
}

function strengthScore(entry: CatalogEntry): number {
  return entry.strengths.length;
}

function sortEntries(entries: CatalogEntry[]): CatalogEntry[] {
  return entries.slice().sort((a, b) => {
    if (b.contextWindow !== a.contextWindow) return b.contextWindow - a.contextWindow;
    return strengthScore(b) - strengthScore(a);
  });
}

function fitsGpu(entry: CatalogEntry, vramGb: number): boolean {
  return entry.vramRequiredGb <= vramGb * VRAM_HEADROOM;
}

function fitsCpu(entry: CatalogEntry, ramGb: number): boolean {
  return entry.format === 'gguf' && entry.ramRequiredGb <= ramGb * RAM_HEADROOM;
}

function exclusionReason(entry: CatalogEntry, profile: HardwareProfile): string | null {
  const vram = profile.gpu?.vramGb ?? 0;
  if (vram > 0) {
    if (entry.vramRequiredGb > vram * VRAM_HEADROOM) {
      return `needs ${entry.vramRequiredGb}GB VRAM (have ${vram}GB)`;
    }
    return null;
  }
  if (entry.format !== 'gguf') return 'CPU-only requires GGUF format';
  if (entry.ramRequiredGb > profile.ramGb * RAM_HEADROOM) {
    return `needs ${entry.ramRequiredGb}GB RAM (have ${profile.ramGb}GB)`;
  }
  return null;
}

function isMarginal(entry: CatalogEntry, profile: HardwareProfile): boolean {
  const vram = profile.gpu?.vramGb ?? 0;
  if (vram > 0) {
    const limit = vram * VRAM_HEADROOM;
    return entry.vramRequiredGb > limit && entry.vramRequiredGb <= limit * 1.15;
  }
  const limit = profile.ramGb * RAM_HEADROOM;
  return entry.format === 'gguf' && entry.ramRequiredGb > limit && entry.ramRequiredGb <= limit * 1.15;
}

export function recommendModels(profile: HardwareProfile): Recommendation {
  const tier = resolveTier(profile);
  const vram = profile.gpu?.vramGb ?? 0;
  const fitting: CatalogEntry[] = [];
  const marginal: CatalogEntry[] = [];
  const excluded: { entry: CatalogEntry; reason: string }[] = [];

  for (const entry of getCatalog()) {
    const reason = exclusionReason(entry, profile);
    if (!reason) {
      fitting.push(entry);
      continue;
    }
    if (isMarginal(entry, profile)) {
      marginal.push(entry);
    } else {
      excluded.push({ entry, reason });
    }
  }

  const sorted = sortEntries(fitting);
  const cpuFiltered = vram <= 0
    ? sorted.filter((e) => e.format === 'gguf')
    : sorted;

  return {
    tier,
    recommended: cpuFiltered.slice(0, 5),
    marginal: sortEntries(marginal).slice(0, 5),
    excluded,
  };
}

export function listFittingModels(profile: HardwareProfile, includeAll = false): CatalogEntry[] {
  if (includeAll) return sortEntries(getCatalog());
  const rec = recommendModels(profile);
  return sortEntries([
    ...rec.recommended,
    ...rec.marginal,
    ...getCatalog().filter((e) => !exclusionReason(e, profile)),
  ].filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i));
}
