import type { KanbanColumn } from '../agents/kanban-types.js';
import {
  addTrelloComment,
  createTrelloCard,
  isTrelloConfigured,
  listTrelloBoards,
  listTrelloLists,
  moveTrelloCard,
  trelloConfigHint,
  updateTrelloCardDesc,
} from '../integrations/trello-client.js';
import { listLeads } from './leads.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type {
  OutreachBoardBackend,
  OutreachBoardConfig,
  OutreachBoardRef,
  OutreachBoardStage,
  OutreachLead,
} from './types.js';

const STAGE_NAMES: OutreachBoardStage[] = [
  'new',
  'contacted',
  'replied',
  'booked',
  'attended',
  'won',
  'lost',
  'nurture',
];

const STAGE_LABELS: Record<OutreachBoardStage, string> = {
  new: 'New / Queued',
  contacted: 'Contacted',
  replied: 'Replied',
  booked: 'Booked',
  attended: 'Showed / In discussion',
  won: 'Won',
  lost: 'Dead',
  nurture: 'Nurture / Follow-up',
};

const NATIVE_COLUMN_BY_STAGE: Record<OutreachBoardStage, KanbanColumn> = {
  new: 'backlog',
  contacted: 'backlog',
  replied: 'in_progress',
  booked: 'review',
  attended: 'review',
  won: 'done',
  lost: 'blocked',
  nurture: 'backlog',
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function stageFromLead(lead: OutreachLead): OutreachBoardStage {
  if (lead.replyState === 'unsubscribed' || lead.status === 'lost' || lead.status === 'ghosted') return 'lost';
  if (lead.status === 'won') return 'won';
  if (lead.status === 'attended' || lead.bookingState === 'attended') return 'attended';
  if (lead.status === 'booked' || lead.bookingState === 'booked') return 'booked';
  if (lead.status === 'follow_up') return 'nurture';
  if (lead.status === 'replied') return 'replied';
  if (lead.status === 'contacted') return 'contacted';
  return 'new';
}

function buildCardDesc(lead: OutreachLead, extra?: { eventTime?: string; note?: string }): string {
  const lines = [
    `Lead ID: ${lead.id}`,
    `Stage: ${STAGE_LABELS[stageFromLead(lead)]}`,
    `Email: ${lead.email ?? '(none)'}`,
    `Phone: ${lead.phone ?? '(none)'}`,
    `Company: ${lead.company ?? '(none)'}`,
    `Last touch: ${lead.lastContactedAt ?? '(none)'}`,
    `Event time: ${extra?.eventTime ?? lead.nextActionAt ?? '(none)'}`,
    `Source: ${lead.source}`,
    `Reply state: ${lead.replyState}`,
    `Booking state: ${lead.bookingState}`,
    `Updated: ${lead.updatedAt}`,
    extra?.note ? `Note: ${extra.note}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

export function getOutreachBoardConfig(workspaceId: string): OutreachBoardConfig | null {
  return loadOutreachStore().boardConfigs[workspaceId] ?? null;
}

export function updateOutreachBoardConfig(workspaceId: string, patch: Partial<Omit<OutreachBoardConfig, 'workspaceId' | 'enabled'>> & { enabled?: boolean }): OutreachBoardConfig {
  const current = getOutreachBoardConfig(workspaceId) ?? {
    workspaceId,
    backend: 'trello' as const,
    enabled: false,
  };
  const next: OutreachBoardConfig = {
    ...current,
    ...patch,
    workspaceId,
    backend: patch.backend ?? current.backend,
    enabled: patch.enabled ?? current.enabled ?? false,
    trelloBoardId: patch.trelloBoardId !== undefined ? patch.trelloBoardId.trim() || undefined : current.trelloBoardId,
    nativeSessionId: patch.nativeSessionId !== undefined ? patch.nativeSessionId.trim() || undefined : current.nativeSessionId,
    nativeBoardId: patch.nativeBoardId !== undefined ? patch.nativeBoardId.trim() || undefined : current.nativeBoardId,
    lastGrantWarning: patch.lastGrantWarning !== undefined ? patch.lastGrantWarning.trim() || undefined : current.lastGrantWarning,
    lastSyncedAt: patch.lastSyncedAt ?? current.lastSyncedAt,
  };
  mutateOutreachStore((store) => {
    store.boardConfigs[workspaceId] = next;
  });
  return next;
}

export function listOutreachBoardStages(): OutreachBoardStage[] {
  return [...STAGE_NAMES];
}

function boardRefKey(workspaceId: string, leadId: string): string {
  return `${workspaceId}:${leadId}`;
}

function getBoardRef(workspaceId: string, leadId: string): OutreachBoardRef | null {
  return loadOutreachStore().boardRefs[boardRefKey(workspaceId, leadId)] ?? null;
}

function setBoardRef(workspaceId: string, ref: OutreachBoardRef): void {
  mutateOutreachStore((store) => {
    store.boardRefs[boardRefKey(workspaceId, ref.leadId)] = ref;
  });
}

function clearBoardRef(workspaceId: string, leadId: string): void {
  mutateOutreachStore((store) => {
    delete store.boardRefs[boardRefKey(workspaceId, leadId)];
  });
}

async function resolveTrelloListId(config: OutreachBoardConfig, stage: OutreachBoardStage): Promise<string | null> {
  const direct = config.trelloListIds?.[stage];
  if (direct) return direct;
  if (!config.trelloBoardId) return null;
  const lists = await listTrelloLists(config.trelloBoardId);
  const stageNames = new Map<string, OutreachBoardStage>();
  for (const item of STAGE_NAMES) {
    stageNames.set(normalizeKey(STAGE_LABELS[item]), item);
    stageNames.set(normalizeKey(item), item);
  }
  const match = lists.find((list) => stageNames.get(normalizeKey(list.name)) === stage);
  return match?.id ?? null;
}

function guessTrelloBoardIdFromConfig(config: OutreachBoardConfig | null): string | null {
  return config?.trelloBoardId ?? null;
}

async function syncTrelloLeadCard(
  workspaceId: string,
  lead: OutreachLead,
  note?: string,
): Promise<{ ok: boolean; cardId?: string; boardId?: string; warning?: string }> {
  if (!(await isTrelloConfigured())) {
    return { ok: false, warning: trelloConfigHint() };
  }
  const config = getOutreachBoardConfig(workspaceId);
  const boardId = guessTrelloBoardIdFromConfig(config);
  if (!config?.enabled || config.backend !== 'trello' || !boardId) {
    return { ok: false, warning: 'Outreach Trello board is not configured' };
  }
  const stage = stageFromLead(lead);
  const listId = await resolveTrelloListId(config, stage);
  if (!listId) {
    return { ok: false, warning: `Could not resolve a Trello list for stage ${stage}` };
  }
  const existing = getBoardRef(workspaceId, lead.id);
  const desc = buildCardDesc(lead, {
    eventTime: lead.nextActionAt ?? undefined,
    note,
  });
  let cardId = existing?.cardId;
  try {
    if (!cardId) {
      const card = await createTrelloCard({
        listId,
        name: `${lead.name}${lead.company ? ` | ${lead.company}` : ''}`,
        desc,
      });
      cardId = card.id;
    } else {
      await moveTrelloCard(cardId, listId);
      await updateTrelloCardDesc(cardId, desc);
    }
    if (note) {
      await addTrelloComment(cardId, note);
    }
    setBoardRef(workspaceId, {
      leadId: lead.id,
      boardBackend: 'trello',
      boardId,
      cardId,
      listId,
      stage,
      updatedAt: nowIso(),
    });
    mutateOutreachStore((store) => {
      const configRow = store.boardConfigs[workspaceId];
      if (configRow) {
        configRow.lastSyncedAt = nowIso();
      }
    });
    return { ok: true, cardId, boardId };
  } catch (err) {
    const warning = err instanceof Error ? err.message : String(err);
    mutateOutreachStore((store) => {
      const configRow = store.boardConfigs[workspaceId];
      if (configRow) {
        configRow.lastGrantWarning = warning;
      }
    });
    return { ok: false, warning };
  }
}

async function syncNativeLeadCard(
  workspaceId: string,
  lead: OutreachLead,
  note?: string,
): Promise<{ ok: boolean; cardId?: string; boardId?: string; warning?: string }> {
  const config = getOutreachBoardConfig(workspaceId);
  if (!config?.enabled || config.backend !== 'native') {
    return { ok: false, warning: 'Native outreach board is not configured' };
  }
  const sessionId = config.nativeSessionId ?? workspaceId;
  const boardId = config.nativeBoardId ?? 'default';
  const stage = stageFromLead(lead);
  const column = NATIVE_COLUMN_BY_STAGE[stage];
  const existing = getBoardRef(workspaceId, lead.id);
  const desc = buildCardDesc(lead, {
    eventTime: lead.nextActionAt ?? undefined,
    note,
  });
  let cardId = existing?.cardId;
  // Dynamic import: top-level kanban-service pulls tools → gateway → SubAgent circular init.
  const native = await import('../agents/kanban-service.js');
  try {
    if (!cardId) {
      const created = await native.createBoardCard('orchestrator', {
        sessionId,
        boardId,
        title: `${lead.name}${lead.company ? ` | ${lead.company}` : ''}`,
        description: desc,
        column,
      });
      cardId = String(created.card_id ?? created.cardId ?? created.id ?? '');
    } else {
      await native.transitionCard('orchestrator', cardId, column);
      await native.patchCard('orchestrator', cardId, {
        description: desc,
      });
    }
    if (note) {
      await native.addComment(cardId, note);
    }
    setBoardRef(workspaceId, {
      leadId: lead.id,
      boardBackend: 'native',
      boardId,
      cardId,
      stage,
      updatedAt: nowIso(),
    });
    mutateOutreachStore((store) => {
      const configRow = store.boardConfigs[workspaceId];
      if (configRow) {
        configRow.lastSyncedAt = nowIso();
      }
    });
    return { ok: true, cardId, boardId };
  } catch (err) {
    const warning = err instanceof Error ? err.message : String(err);
    mutateOutreachStore((store) => {
      const configRow = store.boardConfigs[workspaceId];
      if (configRow) {
        configRow.lastGrantWarning = warning;
      }
    });
    return { ok: false, warning };
  }
}

export async function syncLeadBoardState(
  workspaceId: string,
  leadId: string,
  note?: string,
): Promise<{ ok: boolean; boardBackend?: OutreachBoardBackend; cardId?: string; boardId?: string; warning?: string }> {
  const lead = listLeads(workspaceId).find((row) => row.id === leadId) ?? null;
  if (!lead) {
    clearBoardRef(workspaceId, leadId);
    return { ok: false, warning: 'Lead not found' };
  }
  const config = getOutreachBoardConfig(workspaceId);
  if (!config?.enabled) {
    return { ok: false, warning: 'Outreach board sync is disabled' };
  }
  if (config.backend === 'native') {
    const result = await syncNativeLeadCard(workspaceId, lead, note);
    return { ...result, boardBackend: 'native' };
  }
  const result = await syncTrelloLeadCard(workspaceId, lead, note);
  return { ...result, boardBackend: 'trello' };
}

export function buildOutreachBoardSummary(workspaceId: string): {
  configured: boolean;
  backend: OutreachBoardBackend | null;
  counts: Record<OutreachBoardStage, number>;
  missingGrantWarning?: string;
  lastSyncedAt?: string;
} {
  const config = getOutreachBoardConfig(workspaceId);
  const leads = listLeads(workspaceId);
  const counts = STAGE_NAMES.reduce((acc, stage) => {
    acc[stage] = leads.filter((lead) => stageFromLead(lead) === stage).length;
    return acc;
  }, {} as Record<OutreachBoardStage, number>);
  return {
    configured: Boolean(config?.enabled),
    backend: config?.backend ?? null,
    counts,
    missingGrantWarning: config?.lastGrantWarning,
    lastSyncedAt: config?.lastSyncedAt,
  };
}

export function buildOutreachBoardProvisionHint(workspaceId: string): string {
  const config = getOutreachBoardConfig(workspaceId);
  if (!config?.enabled) {
    return 'Enable outreach board sync in the workspace settings, then choose Trello or native board mode.';
  }
  if (config.backend === 'trello') {
    return config.trelloBoardId
      ? `Trello board ${config.trelloBoardId} is active. Map the stage lists, then sync leads.`
      : 'Trello sync is enabled but no board id is set.';
  }
  return config.nativeSessionId
    ? `Native board sync is active for session ${config.nativeSessionId}.`
    : 'Native board sync is enabled, using the workspace session as the board scope.';
}
