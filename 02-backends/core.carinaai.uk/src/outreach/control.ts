import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type { OutreachControlState } from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

function defaultControl(workspaceId: string): OutreachControlState {
  return {
    workspaceId,
    paused: false,
    updatedAt: nowIso(),
  };
}

export function getOutreachControlState(workspaceId: string): OutreachControlState {
  return loadOutreachStore().controls[workspaceId] ?? defaultControl(workspaceId);
}

export function updateOutreachControlState(
  workspaceId: string,
  patch: Partial<Omit<OutreachControlState, 'workspaceId' | 'updatedAt'>>,
): OutreachControlState {
  const current = getOutreachControlState(workspaceId);
  const next: OutreachControlState = {
    ...current,
    ...patch,
    workspaceId,
    paused: patch.paused ?? current.paused,
    updatedAt: nowIso(),
    updatedBy: patch.updatedBy !== undefined ? patch.updatedBy.trim() || undefined : current.updatedBy,
    reason: patch.reason !== undefined ? patch.reason.trim() || undefined : current.reason,
  };
  mutateOutreachStore((store) => {
    store.controls[workspaceId] = next;
  });
  return next;
}

export function pauseOutreach(workspaceId: string, reason?: string, updatedBy?: string): OutreachControlState {
  return updateOutreachControlState(workspaceId, {
    paused: true,
    reason,
    updatedBy,
  });
}

export function resumeOutreach(workspaceId: string, updatedBy?: string): OutreachControlState {
  return updateOutreachControlState(workspaceId, {
    paused: false,
    reason: undefined,
    updatedBy,
  });
}

export function isOutreachPaused(workspaceId: string): boolean {
  return getOutreachControlState(workspaceId).paused;
}

export function outreachControlSummary(state: OutreachControlState): string {
  return state.paused
    ? `Outreach paused${state.reason ? `: ${state.reason}` : ''}`
    : 'Outreach active';
}
