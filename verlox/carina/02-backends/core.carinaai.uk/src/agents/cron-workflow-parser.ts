import YAML from 'yaml';
import type {
  CronWorkflowDefinition,
  CronWorkflowStep,
} from './cron-workflow-types.js';

const STEP_ID_RE = /^[a-z][a-z0-9_-]{0,63}$/;

export function validateWorkflowDefinition(def: CronWorkflowDefinition): string[] {
  const errors: string[] = [];
  if (def.version !== 1) errors.push('workflow version must be 1');
  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    errors.push('workflow must include at least one step');
    return errors;
  }

  const ids = new Set<string>();
  for (const step of def.steps) {
    if (!STEP_ID_RE.test(step.id)) {
      errors.push(`invalid step id: ${step.id}`);
    }
    if (ids.has(step.id)) errors.push(`duplicate step id: ${step.id}`);
    ids.add(step.id);

    const hasPrompt = Boolean(step.prompt?.trim());
    const hasScript = Boolean(step.scriptPath?.trim());
    if (step.noAgent && !hasScript) {
      errors.push(`step ${step.id}: scriptPath required when noAgent is true`);
    } else if (!step.noAgent && !hasPrompt && !hasScript) {
      errors.push(`step ${step.id}: prompt or scriptPath required`);
    }

    for (const need of step.needs ?? []) {
      if (!ids.has(need) && !def.steps.some((s) => s.id === need)) {
        errors.push(`step ${step.id}: unknown dependency ${need}`);
      }
    }
    for (const ctx of step.contextFrom ?? []) {
      if (!def.steps.some((s) => s.id === ctx)) {
        errors.push(`step ${step.id}: unknown contextFrom ${ctx}`);
      }
    }
  }

  return errors;
}

function normalizeStep(raw: Record<string, unknown>): CronWorkflowStep {
  const id = String(raw.id ?? '').trim();
  const needs = Array.isArray(raw.needs)
    ? raw.needs.map((v) => String(v))
    : raw.needs
      ? [String(raw.needs)]
      : undefined;
  const rawContextFrom = raw.context_from ?? raw.contextFrom;
  const contextFrom = Array.isArray(rawContextFrom)
    ? rawContextFrom.map((v) => String(v))
    : undefined;

  return {
    id,
    prompt: raw.prompt ? String(raw.prompt) : undefined,
    scriptPath: raw.script_path || raw.scriptPath ? String(raw.script_path ?? raw.scriptPath) : undefined,
    noAgent: Boolean(raw.no_agent ?? raw.noAgent),
    needs,
    contextFrom,
    retries: raw.retries != null ? Number(raw.retries) : undefined,
    retryDelayMs: raw.retry_delay_ms != null
      ? Number(raw.retry_delay_ms)
      : raw.retryDelayMs != null
        ? Number(raw.retryDelayMs)
        : undefined,
    deliver: raw.deliver as CronWorkflowStep['deliver'],
    enabledToolsets: (() => { const rawTs = raw.enabled_toolsets ?? raw.enabledToolsets; return Array.isArray(rawTs) ? rawTs.map((v) => String(v)) : undefined; })(),
    workdir: raw.workdir ? String(raw.workdir) : undefined,
  };
}

export function parseWorkflowDocument(raw: unknown): CronWorkflowDefinition {
  const obj = raw as Record<string, unknown>;
  const stepsRaw = (obj.steps ?? []) as Record<string, unknown>[];
  const def: CronWorkflowDefinition = {
    version: 1,
    steps: stepsRaw.map(normalizeStep),
    deliverOn: (obj.deliver_on ?? obj.deliverOn) as CronWorkflowDefinition['deliverOn'],
    onFailure: (() => { const rawOF = obj.on_failure ?? obj.onFailure; return rawOF ? normalizeOnFailure(rawOF as Record<string, unknown>) : undefined; })(),
    maxStepOutputChars: obj.max_step_output_chars != null
      ? Number(obj.max_step_output_chars)
      : obj.maxStepOutputChars != null
        ? Number(obj.maxStepOutputChars)
        : undefined,
  };
  const errors = validateWorkflowDefinition(def);
  if (errors.length > 0) {
    throw new Error(`Invalid workflow: ${errors.join('; ')}`);
  }
  return def;
}

function normalizeOnFailure(raw: Record<string, unknown>) {
  const deliver = raw.deliver;
  return {
    deliver: Array.isArray(deliver) ? deliver.map(String) : deliver ? String(deliver) : undefined,
    message: raw.message ? String(raw.message) : undefined,
  };
}

export function parseWorkflowJson(text: string): CronWorkflowDefinition {
  return parseWorkflowDocument(JSON.parse(text));
}

export function parseWorkflowYaml(text: string): CronWorkflowDefinition {
  return parseWorkflowDocument(YAML.parse(text));
}

export function buildScopedContext(
  step: CronWorkflowStep,
  contextBag: Record<string, string>,
): string {
  const sources = step.contextFrom?.length
    ? step.contextFrom
    : (step.needs ?? []);
  const parts: string[] = [];
  for (const id of sources) {
    const output = contextBag[id];
    if (output) parts.push(`[Step ${id}]\n${output}`);
  }
  return parts.join('\n\n');
}
