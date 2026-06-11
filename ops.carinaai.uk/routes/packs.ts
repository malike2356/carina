import { Router } from 'express';
import { carinaGet, carinaJson, carinaOpsTokenSet, carinaPut } from '../lib/carina.js';
import { parseSelectedPacks } from '../lib/packs.js';

export const packsRouter = Router();

type PackManifest = {
  name: string;
  version: string;
  description: string;
  skillCount?: number;
  category?: string;
};

type SkillPackState = {
  available: PackManifest[];
  active: string[];
  lastChange: {
    actor: string;
    source: string;
    packs_before: string[];
    packs_after: string[];
    created_at: string;
  } | null;
  audit: Array<{
    actor: string;
    source: string;
    packs_before: string[];
    packs_after: string[];
    created_at: string;
  }>;
};

async function loadSkillPackState(): Promise<{
  paired: boolean;
  state: SkillPackState | null;
  error: string | null;
}> {
  if (!carinaOpsTokenSet()) {
    return {
      paired: false,
      state: null,
      error: 'Pair Carina in Settings (CARINA_OPS_TOKEN) before managing skill packs.',
    };
  }
  const response = await carinaGet('/api/ops/skill-packs');
  const parsed = await carinaJson<SkillPackState>(response);
  if (!parsed.ok || !parsed.data) {
    const hint = parsed.status === 401
      ? 'Carina rejected the ops token. Re-pair in Settings.'
      : (parsed.error ?? 'Could not load skill packs from Carina.');
    return { paired: true, state: null, error: hint };
  }
  return { paired: true, state: parsed.data, error: null };
}

async function loadEvalReports(): Promise<Array<{
  runId: string;
  generatedAt: string;
  pack: string;
  passRate: number;
  summary: string;
}>> {
  if (!carinaOpsTokenSet()) return [];
  const response = await carinaGet('/api/ops/eval-reports?limit=10');
  const parsed = await carinaJson<{ reports: Array<{
    runId: string;
    generatedAt: string;
    pack: string;
    passRate: number;
    summary: string;
  }> }>(response);
  if (!parsed.ok || !parsed.data?.reports) return [];
  return parsed.data.reports;
}

packsRouter.get('/', async (req, res) => {
  const saved = req.query.saved === '1';
  const err = typeof req.query.err === 'string' ? req.query.err : '';
  const loaded = await loadSkillPackState();
  const evalReports = await loadEvalReports();
  res.render('packs/index', {
    title: 'Skill Packs',
    paired: loaded.paired,
    error: err || loaded.error,
    saved,
    available: loaded.state?.available ?? [],
    active: new Set(loaded.state?.active ?? []),
    lastChange: loaded.state?.lastChange ?? null,
    audit: loaded.state?.audit ?? [],
    carinaApiUrl: process.env.CARINA_API_URL ?? 'http://localhost:3333',
    evalReports,
  });
});

packsRouter.post('/', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect('/packs?err=' + encodeURIComponent('Pair Carina in Settings first.'));
    return;
  }
  const selected = parseSelectedPacks(req.body as Record<string, unknown>);
  const response = await carinaPut('/api/ops/skill-packs', {
    packs: selected,
    actor: 'ops-admin',
    source: 'ops.carinaai.uk',
  });
  const parsed = await carinaJson<{ error?: string; invalid?: string[] }>(response);
  if (!parsed.ok) {
    const detail = parsed.data?.invalid?.length
      ? `${parsed.error ?? 'Save failed'}: ${parsed.data.invalid.join(', ')}`
      : (parsed.error ?? 'Save failed');
    res.redirect('/packs?err=' + encodeURIComponent(detail));
    return;
  }
  res.redirect('/packs?saved=1');
});
