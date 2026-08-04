import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import { runBinary } from '../exec.js';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { clampInt, sanitizePath } from '../sanitize.js';

const STIX_TLP = new Set(['white', 'green', 'amber', 'red']);
const RECIPE_OP_RE = /^[a-zA-Z0-9 ()'{}.,_+-]+$/;

const STIX_EXPORT_SCRIPT = `
import json
import sys
from datetime import datetime, timezone

import stix2

findings = json.load(open(sys.argv[1], encoding='utf-8'))
out_path = sys.argv[2]
author = sys.argv[4]

indicators = []
for index, finding in enumerate(findings):
    name = str(finding.get('name') or f'indicator-{index}')
    pattern = str(finding.get('pattern') or '')
    if not pattern:
        continue
    indicators.append(stix2.Indicator(
        name=name,
        pattern=pattern,
        pattern_type='stix',
        valid_from=datetime.now(timezone.utc),
        created_by_ref=None,
        description=finding.get('description'),
    ))

bundle = stix2.Bundle(objects=indicators)
with open(out_path, 'w', encoding='utf-8') as handle:
    handle.write(bundle.serialize(pretty=True))
`.trim();

function csvList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return fallback;
}

export function parseRecipeOps(raw: unknown): string[] | { error: string } {
  const ops = csvList(raw, []);
  if (ops.length === 0) return { error: 'recipe is required' };
  for (const op of ops) {
    if (!RECIPE_OP_RE.test(op)) {
      return { error: `invalid cyberchef recipe operation: ${op}` };
    }
  }
  return ops;
}

export function normalizeFindings(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) {
    return raw.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
  }
  return [];
}

async function timesketchFetch(
  sketchId: number,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const apiBase = (process.env.TIMESKETCH_URL ?? 'http://127.0.0.1:5000').replace(/\/$/, '');
  const apiKey = process.env.TIMESKETCH_API_KEY ?? process.env.TIMESKETCH_TOKEN ?? '';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(`${apiBase}/api/v1/sketches/${sketchId}${path}`, { ...init, headers });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        error: `Timesketch API ${response.status}: ${text.slice(0, 500)}`,
      };
    }
    return { ok: true, status: response.status, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function cyberchefFetch(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const apiBase = (process.env.CYBERCHEF_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

  try {
    const response = await fetch(`${apiBase}/bake`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body: parsed,
        error: `CyberChef API ${response.status}: ${text.slice(0, 500)}`,
      };
    }
    return { ok: true, status: response.status, body: parsed };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function createLog2timelineTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 86_400_000,
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Disk image or mount point' },
        outputFile: { type: 'string', description: 'Plaso storage file (.plaso)' },
        parsers: { type: 'array', description: 'Parser filter list' },
        partition: { type: 'string', description: 'Partition number or all' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['image', 'outputFile'],
    },
    buildArgs: (params) => {
      const image = sanitizePath(params.image);
      if (typeof image !== 'string') return image;
      const outputFile = sanitizePath(params.outputFile);
      if (typeof outputFile !== 'string') return outputFile;

      const args: string[] = [];
      const parsers = csvList(params.parsers, []);
      if (parsers.length > 0) args.push('--parsers', parsers.join(','));

      const partition = params.partition != null
        ? String(params.partition)
        : 'all';
      if (!/^all|\d+$/.test(partition)) {
        return { error: 'partition must be "all" or a number' };
      }
      args.push('--partitions', partition, outputFile, image);
      return args;
    },
    resolveBinary: () => 'log2timeline.py',
    formatResult: (result, params, startedAt) => ({
      tool: 'log2timeline',
      image: String(params.image ?? ''),
      outputFile: params.outputFile,
      plasoFile: params.outputFile,
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });

  tool.requiresConfirmation = false;
  return tool;
}

export function createTimesketchTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'status'], description: 'Timesketch action' },
        query: { type: 'string', description: 'Lucene search query' },
        sketchId: { type: 'number', description: 'Timesketch sketch ID' },
        timelineId: { type: 'number', description: 'Timeline ID filter' },
        timeStart: { type: 'string', description: 'ISO8601 start time' },
        timeEnd: { type: 'string', description: 'ISO8601 end time' },
        limit: { type: 'number', description: 'Result limit' },
      },
    },
    execute: async (params) => {
      const action = String(params.action ?? (params.query ? 'search' : 'status'));
      const sketchId = clampInt(params.sketchId ?? process.env.TIMESKETCH_SKETCH_ID ?? 1, 1, 1, 10_000);

      if (action === 'status') {
        const result = await timesketchFetch(sketchId, '/');
        if (!result.ok) {
          return {
            tool: 'timesketch',
            action,
            sketchId,
            error: result.error,
            note: 'Timesketch server required. Set TIMESKETCH_URL and TIMESKETCH_API_KEY.',
          };
        }
        return { tool: 'timesketch', action, sketchId, status: result.body };
      }

      const query = String(params.query ?? '').trim();
      if (!query) return { error: 'query is required for timesketch search' };

      const filter: Record<string, unknown> = {
        limit: clampInt(params.limit, 100, 1, 10_000),
      };
      if (params.timelineId != null) filter.timeline = clampInt(params.timelineId, 0, 1, 10_000);
      if (params.timeStart) filter.from = String(params.timeStart);
      if (params.timeEnd) filter.to = String(params.timeEnd);

      const result = await timesketchFetch(sketchId, '/explore/', {
        method: 'POST',
        body: JSON.stringify({ query, filter }),
      });

      if (!result.ok) {
        return {
          tool: 'timesketch',
          action: 'search',
          sketchId,
          query,
          error: result.error,
        };
      }

      return {
        tool: 'timesketch',
        action: 'search',
        sketchId,
        query,
        results: result.body,
      };
    },
  };
}

export function createStixTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        findings: { type: 'array', description: 'Finding objects with name and pattern' },
        findingsFile: { type: 'string', description: 'JSON file containing findings' },
        outputFile: { type: 'string', description: 'STIX bundle output path' },
        tlp: { type: 'string', enum: ['white', 'green', 'amber', 'red'], description: 'TLP marking' },
        author: { type: 'string', description: 'Bundle author label' },
        engagementId: { type: 'string', description: 'Engagement reference ID' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['outputFile'],
    },
    execute: async (params) => {
      const outputFile = sanitizePath(params.outputFile);
      if (typeof outputFile !== 'string') return outputFile;

      let findings = normalizeFindings(params.findings);
      if (params.findingsFile) {
        const findingsPath = sanitizePath(params.findingsFile);
        if (typeof findingsPath !== 'string') return findingsPath;
        try {
          const raw = await readFile(findingsPath, 'utf8');
          findings = normalizeFindings(JSON.parse(raw));
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      if (findings.length === 0) {
        return { error: 'findings or findingsFile is required' };
      }

      const tlp = String(params.tlp ?? 'amber').toLowerCase();
      if (!STIX_TLP.has(tlp)) return { error: `unsupported TLP value: ${tlp}` };

      const author = String(params.author ?? 'Carina Scout').slice(0, 128);
      const tmpFindings = `/tmp/carina_stix_${Date.now()}.json`;
      await writeFile(tmpFindings, JSON.stringify(findings), 'utf8');

      const timeoutMs = clampInt(params.timeout, 120, 10, 3600) * 1000;
      const result = await runBinary(
        'python3',
        ['-c', STIX_EXPORT_SCRIPT, tmpFindings, outputFile, tlp, author],
        timeoutMs,
      );

      await unlink(tmpFindings).catch(() => undefined);

      if (result.exitCode !== 0) {
        return {
          tool: 'stix',
          outputFile,
          exitCode: result.exitCode,
          error: result.stderr.trim() || 'stix export failed',
          note: 'Requires python3-stix2 (pip install stix2)',
        };
      }

      return {
        tool: 'stix',
        outputFile,
        stixFile: outputFile,
        findingsCount: findings.length,
        tlp,
        author,
        engagementId: params.engagementId,
        exitCode: result.exitCode,
      };
    },
  };
}

export function createCyberchefTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input data or file path' },
        recipe: { type: 'string', description: 'Comma-separated CyberChef operations' },
        inputFromFile: { type: 'boolean', description: 'Read input from file path' },
        outputFile: { type: 'string', description: 'Optional output file path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['input', 'recipe'],
    },
    execute: async (params) => {
      const recipeOps = parseRecipeOps(
        typeof params.recipe === 'string'
          ? params.recipe.split(',').map((s) => s.trim())
          : params.recipe,
      );
      if ('error' in recipeOps) return recipeOps;

      let inputData = String(params.input ?? '');
      if (params.inputFromFile === true) {
        const inputPath = sanitizePath(params.input);
        if (typeof inputPath !== 'string') return inputPath;
        try {
          inputData = await readFile(inputPath, 'utf8');
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }

      const bakeBody = {
        input: inputData,
        recipe: recipeOps.map((op) => ({ op })),
      };

      const result = await cyberchefFetch(bakeBody);
      if (!result.ok) {
        return {
          tool: 'cyberchef',
          recipe: recipeOps,
          error: result.error,
          note: 'CyberChef server required. Set CYBERCHEF_URL (default http://127.0.0.1:3000).',
        };
      }

      const body = result.body as { value?: string } | null;
      const output = body?.value ?? body;

      if (params.outputFile) {
        const outputPath = sanitizePath(params.outputFile);
        if (typeof outputPath !== 'string') return outputPath;
        await writeFile(outputPath, String(output ?? ''), 'utf8');
      }

      return {
        tool: 'cyberchef',
        recipe: recipeOps,
        output,
        outputFile: params.outputFile,
      };
    },
  };
}

export function resolveTimelineEngine(engine: unknown): string {
  const value = String(engine ?? 'log2timeline').trim().toLowerCase();
  if (value === 'plasmo' || value === 'psteal') return 'plasmo';
  return 'log2timeline';
}
