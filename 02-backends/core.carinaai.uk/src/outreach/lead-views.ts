/**
 * Saved CRM lead views (workspace-scoped, owner + optional share).
 */

import crypto from 'crypto';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type { LeadSavedView } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

export function listLeadViews(workspaceId: string, userId?: string): LeadSavedView[] {
  return loadOutreachStore().leadViews
    .filter((v) => {
      if (v.workspaceId !== workspaceId) return false;
      if (!userId) return true;
      if (!v.ownerUserId || v.ownerUserId === userId) return true;
      if (v.shared && (v.sharedWith?.includes(userId) || v.sharedWith?.includes('*'))) return true;
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getLeadView(workspaceId: string, viewId: string): LeadSavedView | null {
  return loadOutreachStore().leadViews.find((v) => v.workspaceId === workspaceId && v.id === viewId) ?? null;
}

export function createLeadView(input: {
  workspaceId: string;
  name: string;
  ownerUserId?: string;
  filters?: LeadSavedView['filters'];
  columns?: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
  sort?: LeadSavedView['sort'];
  density?: LeadSavedView['density'];
  shared?: boolean;
  sharedWith?: string[];
}): LeadSavedView {
  const now = nowIso();
  const view: LeadSavedView = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name.trim() || 'Untitled view',
    ownerUserId: input.ownerUserId,
    filters: input.filters ?? {},
    columns: input.columns,
    columnOrder: input.columnOrder,
    columnWidths: input.columnWidths,
    hiddenColumns: input.hiddenColumns,
    sort: input.sort,
    density: input.density ?? 'compact',
    shared: Boolean(input.shared),
    sharedWith: input.sharedWith ?? [],
    createdAt: now,
    updatedAt: now,
  };
  mutateOutreachStore((s) => {
    s.leadViews.push(view);
  });
  return view;
}

export function updateLeadView(
  workspaceId: string,
  viewId: string,
  patch: Partial<Omit<LeadSavedView, 'id' | 'workspaceId' | 'createdAt'>>,
  actorUserId?: string,
): LeadSavedView | null {
  const existing = getLeadView(workspaceId, viewId);
  if (!existing) return null;
  if (existing.ownerUserId && actorUserId && existing.ownerUserId !== actorUserId && !existing.shared) {
    return null;
  }
  const next: LeadSavedView = {
    ...existing,
    ...patch,
    name: patch.name !== undefined ? (patch.name.trim() || existing.name) : existing.name,
    updatedAt: nowIso(),
  };
  mutateOutreachStore((s) => {
    const idx = s.leadViews.findIndex((v) => v.id === viewId);
    if (idx >= 0) s.leadViews[idx] = next;
  });
  return next;
}

export function deleteLeadView(workspaceId: string, viewId: string, actorUserId?: string): boolean {
  const existing = getLeadView(workspaceId, viewId);
  if (!existing) return false;
  if (existing.ownerUserId && actorUserId && existing.ownerUserId !== actorUserId) return false;
  mutateOutreachStore((s) => {
    s.leadViews = s.leadViews.filter((v) => !(v.workspaceId === workspaceId && v.id === viewId));
  });
  return true;
}

/** Per-user grid layout prefs (stored as a special system view). */
export const GRID_PREFS_VIEW_NAME = '__crm_grid_prefs__';

export function upsertGridPrefs(input: {
  workspaceId: string;
  ownerUserId: string;
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
  density?: LeadSavedView['density'];
  sort?: LeadSavedView['sort'];
}): LeadSavedView {
  const existing = listLeadViews(input.workspaceId, input.ownerUserId)
    .find((v) => v.name === GRID_PREFS_VIEW_NAME && v.ownerUserId === input.ownerUserId);
  if (existing) {
    return updateLeadView(input.workspaceId, existing.id, {
      columnOrder: input.columnOrder ?? existing.columnOrder,
      columnWidths: input.columnWidths ?? existing.columnWidths,
      hiddenColumns: input.hiddenColumns ?? existing.hiddenColumns,
      density: input.density ?? existing.density,
      sort: input.sort ?? existing.sort,
    }, input.ownerUserId)!;
  }
  return createLeadView({
    workspaceId: input.workspaceId,
    name: GRID_PREFS_VIEW_NAME,
    ownerUserId: input.ownerUserId,
    columnOrder: input.columnOrder,
    columnWidths: input.columnWidths,
    hiddenColumns: input.hiddenColumns,
    density: input.density,
    sort: input.sort,
    shared: false,
  });
}

export function getGridPrefs(workspaceId: string, ownerUserId: string): LeadSavedView | null {
  return listLeadViews(workspaceId, ownerUserId)
    .find((v) => v.name === GRID_PREFS_VIEW_NAME && v.ownerUserId === ownerUserId) ?? null;
}
