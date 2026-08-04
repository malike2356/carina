import { query, tableExists } from './db.js';

export type AiProductScopeId =
  | 'ops_assistant'
  | 'carina_platform'
  | 'aiva_platform'
  | 'aiva_trial'
  | 'aiva_paid';

export type AiProductScopeDef = {
  id: AiProductScopeId;
  label: string;
  blurb: string;
  /** When set, UI shows this scope as following another live setting. */
  inherits?: AiProductScopeId;
  /** Where the preference is applied today. */
  applies: 'live' | 'recorded';
};

export const AI_PRODUCT_SCOPES: AiProductScopeDef[] = [
  {
    id: 'ops_assistant',
    label: 'Ops Assistant',
    blurb: 'Ops Assistant chat widget and /ops-assistant admin coach.',
    applies: 'live',
  },
  {
    id: 'carina_platform',
    label: 'Carina core',
    blurb: 'Platform default provider and model for Carina runtime (rotation / failover root).',
    applies: 'live',
  },
  {
    id: 'aiva_platform',
    label: 'Aiva platform',
    blurb: 'Aiva workers inherit Carina platform default unless trial/paid lane or workspace BYOK overrides.',
    inherits: 'carina_platform',
    applies: 'live',
  },
  {
    id: 'aiva_trial',
    label: 'Aiva free trial',
    blurb: 'Forced provider/model for trial, pending, and non-paid Aiva workspaces.',
    applies: 'live',
  },
  {
    id: 'aiva_paid',
    label: 'Aiva paid users',
    blurb: 'Forced provider/model for active/past_due Aiva subscriptions.',
    applies: 'live',
  },
];

export type AiProductLlmRow = {
  scope: AiProductScopeId;
  provider: string;
  model: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

async function ensureTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ops_ai_product_llms (
      scope TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )
  `);
}

export async function listAiProductLlms(): Promise<Record<AiProductScopeId, AiProductLlmRow>> {
  await ensureTable();
  const result = await query<{
    scope: string;
    provider: string;
    model: string;
    updated_at: string | Date;
    updated_by: string | null;
  }>(`SELECT scope, provider, model, updated_at, updated_by FROM ops_ai_product_llms`);

  const out = {} as Record<AiProductScopeId, AiProductLlmRow>;
  for (const def of AI_PRODUCT_SCOPES) {
    out[def.id] = {
      scope: def.id,
      provider: '',
      model: '',
      updatedAt: null,
      updatedBy: null,
    };
  }
  for (const row of result.rows) {
    if (!(row.scope in out)) continue;
    const scope = row.scope as AiProductScopeId;
    out[scope] = {
      scope,
      provider: row.provider || '',
      model: row.model || '',
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      updatedBy: row.updated_by,
    };
  }
  return out;
}

export async function upsertAiProductLlm(input: {
  scope: AiProductScopeId;
  provider: string;
  model: string;
  updatedBy?: string | null;
}): Promise<AiProductLlmRow> {
  await ensureTable();
  const provider = String(input.provider || '').trim().toLowerCase();
  const model = String(input.model || '').trim();
  await query(
    `INSERT INTO ops_ai_product_llms (scope, provider, model, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (scope) DO UPDATE
       SET provider = EXCLUDED.provider,
           model = EXCLUDED.model,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
    [input.scope, provider, model, input.updatedBy ?? null],
  );
  const all = await listAiProductLlms();
  return all[input.scope];
}

export async function getAiProductLlm(scope: AiProductScopeId): Promise<AiProductLlmRow | null> {
  if (!(await tableExists('ops_ai_product_llms'))) return null;
  const all = await listAiProductLlms();
  const row = all[scope];
  if (!row.provider && !row.model) return null;
  return row;
}

/** Map provider id to OpenAI-compatible chat endpoint used by Ops Assistant. */
export function resolveOpsAssistantEndpoint(provider: string, model: string, env: NodeJS.ProcessEnv = process.env): {
  url: string;
  key: string;
  model: string;
  provider: string;
} | null {
  const p = (provider || '').trim().toLowerCase();
  const preferredModel = (model || '').trim();

  const deepseekKey = env.DEEPSEEK_API_KEY?.trim() || '';
  const openaiKey = env.OPENAI_API_KEY?.trim() || '';
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim() || '';
  const opsKey = env.OPS_ASSISTANT_API_KEY?.trim() || '';
  const openrouterKey = env.OPENROUTER_API_KEY?.trim() || '';

  if (p === 'deepseek' && (deepseekKey || opsKey)) {
    return {
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: deepseekKey || opsKey,
      model: preferredModel || 'deepseek-chat',
      provider: 'deepseek',
    };
  }
  if (p === 'openai' && (openaiKey || opsKey)) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      key: openaiKey || opsKey,
      model: preferredModel || 'gpt-4o-mini',
      provider: 'openai',
    };
  }
  if (p === 'openrouter' && (openrouterKey || opsKey)) {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: openrouterKey || opsKey,
      model: preferredModel || 'openrouter/auto',
      provider: 'openrouter',
    };
  }
  if (p === 'anthropic' && (anthropicKey || opsKey)) {
    // Anthropic Messages API is not OpenAI-compatible; fall through to DeepSeek/OpenAI if present.
  }

  if (deepseekKey || (opsKey && !openaiKey)) {
    return {
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: deepseekKey || opsKey,
      model: preferredModel || 'deepseek-chat',
      provider: 'deepseek',
    };
  }
  if (openaiKey || opsKey) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      key: openaiKey || opsKey,
      model: preferredModel || 'gpt-4o-mini',
      provider: 'openai',
    };
  }
  return null;
}
