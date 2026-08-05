import crypto from 'crypto';
import { VcalError } from './errors.js';
import { loadVicalStore, mutateVicalStore } from './store.js';
import type {
  VcalEventType,
  VcalIntakePool,
  VcalIntakeQuestion,
  VcalIntakeRoutingRule,
  VcalStoreShape,
} from './types.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function questionKey(row: Record<string, unknown>, idx: number): string {
  return typeof row.key === 'string' && row.key.trim() !== '' ? row.key.trim() : `q_${idx}`;
}

function questionLabel(row: Record<string, unknown>, fallback: string): string {
  return typeof row.label === 'string' && row.label.trim() !== '' ? row.label.trim() : fallback;
}

function normalizeQuestion(row: unknown, idx: number): VcalIntakeQuestion | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const item = row as Record<string, unknown>;
  const key = questionKey(item, idx);
  const label = questionLabel(item, key);
  const type = item.type === 'select' || item.type === 'number' ? item.type : 'text';
  const choices = Array.isArray(item.choices) ? item.choices.map(String).filter(Boolean) : undefined;
  const disqualifyValues = Array.isArray(item.disqualify_values)
    ? item.disqualify_values.map(String).filter(Boolean)
    : Array.isArray(item.disqualifyValues)
      ? item.disqualifyValues.map(String).filter(Boolean)
      : undefined;
  const disqualifyMessage =
    typeof item.disqualify_message === 'string'
      ? item.disqualify_message.trim()
      : typeof item.disqualifyMessage === 'string'
        ? item.disqualifyMessage.trim()
        : undefined;
  return {
    key,
    label,
    type,
    required: Boolean(item.required),
    choices,
    disqualifyValues,
    disqualifyMessage,
  };
}

function normalizeRoutingRule(row: unknown, idx: number): VcalIntakeRoutingRule | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const item = row as Record<string, unknown>;
  const routeToEventTypeId =
    typeof item.routeToEventTypeId === 'string'
      ? item.routeToEventTypeId.trim()
      : typeof item.route_to_event_type_id === 'string'
        ? item.route_to_event_type_id.trim()
        : '';
  if (!routeToEventTypeId) return null;
  const match = typeof item.match === 'object' && item.match && !Array.isArray(item.match)
    ? Object.fromEntries(
        Object.entries(item.match as Record<string, unknown>)
          .map(([key, value]) => [String(key), String(value ?? '').trim()])
          .filter(([, value]) => value !== ''),
      )
    : {};
  return {
    match,
    routeToEventTypeId,
    priority: typeof item.priority === 'number' ? item.priority : idx,
    label: typeof item.label === 'string' ? item.label.trim() : undefined,
  };
}

export function listIntakePools(workspaceId: string): VcalIntakePool[] {
  return loadVicalStore()
    .intakePools.filter((pool) => pool.workspaceId === workspaceId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getIntakePool(workspaceId: string, poolId: string): VcalIntakePool | null {
  return loadVicalStore().intakePools.find((pool) => pool.workspaceId === workspaceId && pool.id === poolId) ?? null;
}

export function createIntakePool(input: {
  workspaceId: string;
  hostUserId: string;
  name: string;
  slug?: string;
  questions?: unknown[];
  routingRules?: unknown[];
}): VcalIntakePool {
  const stamp = nowIso();
  const slug =
    input.slug?.trim() ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    'question-set';
  const row: VcalIntakePool = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    name: input.name.trim(),
    slug,
    questions: (input.questions ?? []).map(normalizeQuestion).filter((item): item is VcalIntakeQuestion => item !== null),
    routingRules: (input.routingRules ?? []).map(normalizeRoutingRule).filter((item): item is VcalIntakeRoutingRule => item !== null),
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    store.intakePools.push(row);
  });
  return row;
}

export function updateIntakePool(
  workspaceId: string,
  poolId: string,
  patch: Partial<Pick<VcalIntakePool, 'name' | 'slug'>> & {
    questions?: unknown[];
    routingRules?: unknown[];
  },
): VcalIntakePool {
  const existing = getIntakePool(workspaceId, poolId);
  if (!existing) throw new VcalError('not_found', 'Intake pool not found');
  const next: VcalIntakePool = {
    ...existing,
    ...patch,
    name: patch.name ? patch.name.trim() : existing.name,
    slug:
      patch.slug?.trim() ||
      existing.slug ||
      existing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    questions: patch.questions ? patch.questions.map(normalizeQuestion).filter((item): item is VcalIntakeQuestion => item !== null) : existing.questions,
    routingRules: patch.routingRules ? patch.routingRules.map(normalizeRoutingRule).filter((item): item is VcalIntakeRoutingRule => item !== null) : existing.routingRules,
    updatedAt: nowIso(),
  };
  mutateVicalStore((store) => {
    const idx = store.intakePools.findIndex((pool) => pool.workspaceId === workspaceId && pool.id === poolId);
    if (idx >= 0) store.intakePools[idx] = next;
  });
  return next;
}

export function deleteIntakePool(workspaceId: string, poolId: string): boolean {
  let removed = false;
  mutateVicalStore((store) => {
    const before = store.intakePools.length;
    store.intakePools = store.intakePools.filter((pool) => !(pool.workspaceId === workspaceId && pool.id === poolId));
    store.eventTypes = store.eventTypes.map((eventType) =>
      eventType.workspaceId === workspaceId && eventType.intakePoolId === poolId
        ? { ...eventType, intakePoolId: null, updatedAt: nowIso() }
        : eventType,
    );
    removed = store.intakePools.length < before;
  });
  return removed;
}

export function resolvedIntakeQuestions(eventType: VcalEventType, store: VcalStoreShape = loadVicalStore()): VcalIntakeQuestion[] {
  if (!eventType.intakePoolId) return [];
  const pool = store.intakePools.find((item) => item.workspaceId === eventType.workspaceId && item.id === eventType.intakePoolId);
  return pool ? pool.questions : [];
}

export function resolvedIntakeRoutingRules(eventType: VcalEventType, store: VcalStoreShape = loadVicalStore()): VcalIntakeRoutingRule[] {
  if (!eventType.intakePoolId) return [];
  const pool = store.intakePools.find((item) => item.workspaceId === eventType.workspaceId && item.id === eventType.intakePoolId);
  return pool ? pool.routingRules : [];
}

export function validateAndRouteIntake(input: {
  eventType: VcalEventType;
  answers?: Record<string, unknown> | null;
  store?: VcalStoreShape;
}): { answers: Record<string, string>; routedEventTypeId: string | null } {
  const store = input.store ?? loadVicalStore();
  const eventType = input.eventType;
  const pool = eventType.intakePoolId
    ? store.intakePools.find((item) => item.workspaceId === eventType.workspaceId && item.id === eventType.intakePoolId) ?? null
    : null;
  if (!pool) {
    return { answers: {}, routedEventTypeId: null };
  }

  const schema = pool.questions;
  const answers = input.answers ?? {};
  if (schema.length > 0 && Object.keys(answers).length === 0) {
    throw new VcalError('intake_required', 'Please complete the booking questions', {
      intakePoolId: pool.id,
      questions: schema,
    });
  }

  const normalized: Record<string, string> = {};
  for (const [idx, row] of schema.entries()) {
    const key = row.key || `q_${idx}`;
    const raw = answers[key];
    const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
    if (row.required && value === '') {
      throw new VcalError('intake_required', `Please answer: ${row.label}`, {
        intakePoolId: pool.id,
        field: key,
      });
    }
    if (value === '') continue;
    if (row.type === 'select' && Array.isArray(row.choices) && row.choices.length > 0 && !row.choices.includes(value)) {
      throw new VcalError('intake_invalid_choice', `Invalid choice for: ${row.label}`, {
        intakePoolId: pool.id,
        field: key,
      });
    }
    if (row.type === 'number' && Number.isNaN(Number(value))) {
      throw new VcalError('intake_invalid_number', `Invalid number for: ${row.label}`, {
        intakePoolId: pool.id,
        field: key,
      });
    }
    if (Array.isArray(row.disqualifyValues) && row.disqualifyValues.includes(value)) {
      throw new VcalError(
        'intake_disqualified',
        row.disqualifyMessage || 'Thanks for your answers. This session is not the right fit, so we will not schedule this booking.',
        { intakePoolId: pool.id, field: key },
      );
    }
    normalized[key] = value;
  }

  const match = pool.routingRules
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .find((rule) => Object.entries(rule.match).every(([key, value]) => normalized[key] === value));
  if (!match) {
    return { answers: normalized, routedEventTypeId: null };
  }
  const routed = store.eventTypes.find(
    (item) => item.workspaceId === eventType.workspaceId && item.id === match.routeToEventTypeId && item.active,
  );
  if (!routed) {
    throw new VcalError('intake_route_missing', 'Routed event type not found', {
      intakePoolId: pool.id,
      routeToEventTypeId: match.routeToEventTypeId,
    });
  }
  return { answers: normalized, routedEventTypeId: routed.id };
}
