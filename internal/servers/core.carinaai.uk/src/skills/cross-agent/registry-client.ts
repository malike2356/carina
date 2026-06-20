import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../../config/paths.js';
import type { FormatDefinition, FormatRegistryIndex } from './registry-schema.js';
import type { FormatDetectionResult } from './types.js';
import { BUNDLED_FORMAT_DEFINITIONS, DEFAULT_REGISTRY_URL } from './bundled-formats.js';
import { nameFromFileName } from './utils.js';

const CACHE_TTL_MS = Number(process.env.CARINA_FORMAT_REGISTRY_TTL_MS ?? 3_600_000);

export class FormatRegistryClient {
  private formats = new Map<string, FormatDefinition>();
  private lastFetched = 0;
  private readonly registryUrl: string;

  constructor(registryUrl = DEFAULT_REGISTRY_URL) {
    this.registryUrl = registryUrl;
    for (const def of BUNDLED_FORMAT_DEFINITIONS) {
      this.formats.set(def.id, def);
    }
  }

  async ensureLoaded(force = false): Promise<void> {
    if (!force && Date.now() - this.lastFetched < CACHE_TTL_MS) return;
    await this.refresh(force);
  }

  async refresh(force = false): Promise<void> {
    if (!force && Date.now() - this.lastFetched < CACHE_TTL_MS) return;

    const cacheFile = path.join(resolveCarinaHome(), 'skills', 'format-registry-cache.json');
    try {
      const remote = await fetch(`${this.registryUrl}/index.json`, { signal: AbortSignal.timeout(8000) });
      if (remote.ok) {
        const index = await remote.json() as { formats?: FormatDefinition[] };
        for (const def of index.formats ?? []) {
          this.formats.set(def.id, def);
        }
        await fs.mkdir(path.dirname(cacheFile), { recursive: true });
        const payload: FormatRegistryIndex = {
          version: 1,
          formats: [...this.formats.values()],
          fetchedAt: new Date().toISOString(),
        };
        await fs.writeFile(cacheFile, JSON.stringify(payload, null, 2), 'utf8');
        this.lastFetched = Date.now();
        return;
      }
    } catch {
      // fall through to cache/bundled
    }

    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8')) as FormatRegistryIndex;
      for (const def of cached.formats ?? []) {
        this.formats.set(def.id, def);
      }
      this.lastFetched = Date.now();
    } catch {
      this.lastFetched = Date.now();
    }
  }

  getFormat(id: string): FormatDefinition | undefined {
    return this.formats.get(id);
  }

  listFormats(): FormatDefinition[] {
    return [...this.formats.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  searchFormats(query: string): FormatDefinition[] {
    const q = query.toLowerCase();
    return this.listFormats().filter((f) =>
      f.id.includes(q)
      || f.name.toLowerCase().includes(q)
      || f.ecosystem.toLowerCase().includes(q)
      || f.description.toLowerCase().includes(q),
    );
  }

  async checkForUpdates(): Promise<{ hasUpdates: boolean; newFormats: string[] }> {
    const before = new Set(this.formats.keys());
    await this.refresh(true);
    const newFormats = [...this.formats.keys()].filter((id) => !before.has(id));
    return { hasUpdates: newFormats.length > 0, newFormats };
  }

  matchFormat(content: string, fileName: string): FormatDetectionResult | null {
    const sample = content.slice(0, 2048);
    const lowerFile = fileName.toLowerCase();
    let best: FormatDetectionResult | null = null;

    for (const def of this.formats.values()) {
      let score = 0;
      let checks = 0;

      for (const pattern of def.detection.fileNames ?? []) {
        checks++;
        if (lowerFile.includes(pattern.toLowerCase())) score++;
      }
      for (const pattern of def.detection.filePaths ?? []) {
        checks++;
        if (lowerFile.includes(pattern.toLowerCase())) score++;
      }
      for (const pattern of def.detection.contentPatterns ?? []) {
        checks++;
        if (new RegExp(pattern, 'im').test(sample) || new RegExp(pattern, 'im').test(fileName)) score++;
      }

      if (checks === 0) continue;
      const coverage = score / checks;
      const fileNameBoost = (def.detection.fileNames ?? []).some((p) => lowerFile.includes(p.toLowerCase())) ? 0.15 : 0;
      const adjusted = coverage + fileNameBoost;
      if (adjusted < 0.34) continue;
      const confidence = Math.min(0.95, 0.7 + adjusted * 0.25);
      const candidate: FormatDetectionResult = {
        format: def.id,
        confidence,
        converter: def.id,
        metadata: {
          fileName,
          originalFormat: def.id,
          sourceUrl: fileName,
          content,
        },
      };
      if (!best || candidate.confidence > best.confidence) best = candidate;
    }
    return best;
  }
}

let singleton: FormatRegistryClient | null = null;

export function getFormatRegistryClient(): FormatRegistryClient {
  if (!singleton) singleton = new FormatRegistryClient();
  return singleton;
}

export function _resetFormatRegistryClientForTests(): void {
  singleton = null;
}
