import YAML from 'yaml';
import type { TaskFlowStep, TaskFlowTrigger, TaskFlowYamlDocument } from './types.js';

const STEP_TYPES = new Set([
  'webhook', 'agent', 'delay', 'cron', 'tool', 'subagent', 'kanban', 'flow',
]);

function normalizeStep(raw: Record<string, unknown>): TaskFlowStep {
  const type = String(raw.type ?? '').trim();
  if (!STEP_TYPES.has(type)) {
    throw new Error(`Unknown step type: ${type}`);
  }

  if (type === 'webhook') {
    return {
      type: 'webhook',
      event: String(raw.event ?? ''),
      payload: raw.payload as Record<string, unknown> | undefined,
    };
  }
  if (type === 'agent') {
    return {
      type: 'agent',
      prompt: String(raw.prompt ?? ''),
      profile: raw.profile ? String(raw.profile) : undefined,
      model: normalizeModel(raw.model ?? raw.model_override),
    };
  }
  if (type === 'delay') {
    return { type: 'delay', ms: Number(raw.ms ?? raw.delay_ms ?? 1000) };
  }
  if (type === 'cron') {
    return { type: 'cron', jobId: String(raw.job_id ?? raw.jobId ?? '') };
  }
  if (type === 'tool') {
    return {
      type: 'tool',
      name: String(raw.name ?? ''),
      args: (raw.args ?? raw.params) as Record<string, unknown> | undefined,
    };
  }
  if (type === 'subagent') {
    const rawType = String(raw.agent_type ?? raw.agentType ?? 'research');
    const agentType = (['research', 'coding', 'communication', 'file'].includes(rawType)
      ? rawType
      : 'research') as 'research' | 'coding' | 'communication' | 'file';
    return {
      type: 'subagent',
      agentType,
      prompt: String(raw.prompt ?? ''),
      model: normalizeModel(raw.model ?? raw.model_override),
    };
  }
  if (type === 'kanban') {
    return {
      type: 'kanban',
      action: String(raw.action ?? 'create_cards') as 'create_cards' | 'run_lanes' | 'wait_review',
      sessionId: raw.session_id || raw.sessionId ? String(raw.session_id ?? raw.sessionId) : undefined,
      titles: Array.isArray(raw.titles) ? raw.titles.map(String) : undefined,
      cardIds: (() => { const rawCids = raw.card_ids ?? raw.cardIds; return Array.isArray(rawCids) ? rawCids.map(String) : undefined; })(),
    };
  }
  if (type === 'flow') {
    return {
      type: 'flow',
      flowId: String(raw.flow_id ?? raw.flowId ?? ''),
      wait: raw.wait !== false,
    };
  }
  throw new Error(`Unsupported step type: ${type}`);
}

function normalizeModel(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const provider = m.provider ? String(m.provider) : undefined;
  const model = m.model ? String(m.model) : undefined;
  if (!provider && !model) return undefined;
  return { provider, model };
}

function normalizeTrigger(raw: Record<string, unknown>): TaskFlowTrigger {
  const type = String(raw.type ?? 'manual');
  if (type === 'cron') return { type: 'cron', jobId: String(raw.job_id ?? raw.jobId ?? '') };
  if (type === 'webhook') return { type: 'webhook', event: String(raw.event ?? '') };
  if (type === 'subagent') {
    return {
      type: 'subagent',
      agentType: raw.agent_type || raw.agentType ? String(raw.agent_type ?? raw.agentType) : undefined,
    };
  }
  if (type === 'kanban') {
    return { type: 'kanban', event: String(raw.event ?? 'review') as 'review' | 'done' | 'move' };
  }
  return { type: 'manual' };
}

export function validateTaskFlowDocument(doc: TaskFlowYamlDocument): string[] {
  const errors: string[] = [];
  if (!doc.name?.trim()) errors.push('name is required');
  if (!Array.isArray(doc.steps) || doc.steps.length === 0) errors.push('at least one step is required');
  for (const [i, step] of (doc.steps ?? []).entries()) {
    if (step.type === 'agent' && !step.prompt?.trim()) errors.push(`step ${i}: agent prompt required`);
    if (step.type === 'cron' && !step.jobId) errors.push(`step ${i}: jobId required`);
    if (step.type === 'tool' && !step.name) errors.push(`step ${i}: tool name required`);
    if (step.type === 'flow' && !step.flowId) errors.push(`step ${i}: flowId required`);
  }
  return errors;
}

export function parseTaskFlowDocument(raw: unknown): TaskFlowYamlDocument {
  const obj = raw as Record<string, unknown>;
  const stepsRaw = (obj.steps ?? []) as Record<string, unknown>[];
  const triggersRaw = (obj.triggers ?? []) as Record<string, unknown>[];
  const doc: TaskFlowYamlDocument = {
    name: String(obj.name ?? ''),
    label: obj.label ? String(obj.label) : undefined,
    profile: obj.profile ? String(obj.profile) : undefined,
    profileName: obj.profile_name || obj.profileName
      ? String(obj.profile_name ?? obj.profileName)
      : obj.profile ? String(obj.profile) : undefined,
    model: normalizeModel(obj.model ?? obj.model_override),
    maxRetries: obj.max_retries != null ? Number(obj.max_retries) : obj.maxRetries != null ? Number(obj.maxRetries) : undefined,
    chainOnSuccess: (() => { const rawCos = obj.chain_on_success ?? obj.chainOnSuccess; return Array.isArray(rawCos) ? rawCos.map(String) : undefined; })(),
    triggers: triggersRaw.map(normalizeTrigger),
    steps: stepsRaw.map(normalizeStep),
  };
  const errors = validateTaskFlowDocument(doc);
  if (errors.length > 0) throw new Error(`Invalid TaskFlow: ${errors.join('; ')}`);
  return doc;
}

export function parseTaskFlowYaml(text: string): TaskFlowYamlDocument {
  const raw = YAML.parse(text);
  return parseTaskFlowDocument(raw);
}
