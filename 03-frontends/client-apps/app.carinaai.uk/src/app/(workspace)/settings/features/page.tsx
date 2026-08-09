'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invalidateWorkspaceFeaturesCache } from '@/hooks/useWorkspaceFeatures';
import type { ResolvedWorkspaceFeature, WorkspaceFeatureCategory } from '@/lib/workspace-features';

type FeatureGroup = {
  category: WorkspaceFeatureCategory;
  label: string;
  features: ResolvedWorkspaceFeature[];
};

function sourceLabel(feature: ResolvedWorkspaceFeature): string {
  if (feature.alwaysOn) return 'Always available';
  if (feature.source === 'workspace_override') return 'Overridden by workspace admin';
  if (feature.source === 'platform_disabled') return 'Disabled by platform';
  return 'Using platform default';
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
        value ? 'bg-accent' : 'border-border bg-elevated',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          value ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export default function WorkspaceFeaturesSettingsPage() {
  const { push } = useToast();
  const [groups, setGroups] = useState<FeatureGroup[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace/settings/features');
      const body = (await res.json()) as {
        groups?: FeatureGroup[];
        canManage?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? 'Failed to load features');
      setGroups(body.groups ?? []);
      setCanManage(Boolean(body.canManage));
    } catch (error) {
      push(error instanceof Error ? error.message : 'Failed to load features', 'error');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setEnabled(feature: ResolvedWorkspaceFeature, enabled: boolean) {
    if (!canManage || feature.alwaysOn) return;
    setPendingKey(feature.key);
    try {
      const res = await fetch(`/api/workspace/settings/features/${feature.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const body = (await res.json()) as {
        feature?: ResolvedWorkspaceFeature;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? 'Could not update feature');
      invalidateWorkspaceFeaturesCache();
      if (body.feature) {
        setGroups((current) =>
          current.map((group) => ({
            ...group,
            features: group.features.map((item) =>
              item.key === body.feature!.key ? body.feature! : item,
            ),
          })),
        );
      } else {
        await load();
      }
      push(enabled ? `${feature.label} enabled` : `${feature.label} disabled`, 'success');
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not update feature', 'error');
    } finally {
      setPendingKey(null);
    }
  }

  async function clearOverride(feature: ResolvedWorkspaceFeature) {
    if (!canManage || !feature.overridden) return;
    setPendingKey(feature.key);
    try {
      const res = await fetch(`/api/workspace/settings/features/${feature.key}`, {
        method: 'DELETE',
      });
      const body = (await res.json()) as {
        feature?: ResolvedWorkspaceFeature;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? 'Could not clear override');
      invalidateWorkspaceFeaturesCache();
      if (body.feature) {
        setGroups((current) =>
          current.map((group) => ({
            ...group,
            features: group.features.map((item) =>
              item.key === body.feature!.key ? body.feature! : item,
            ),
          })),
        );
      } else {
        await load();
      }
      push(`${feature.label} reset to platform default`, 'success');
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not clear override', 'error');
    } finally {
      setPendingKey(null);
    }
  }

  async function resetAll() {
    if (!canManage) return;
    if (!window.confirm('Reset all feature overrides to platform defaults?')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/workspace/settings/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const body = (await res.json()) as { groups?: FeatureGroup[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Reset failed');
      invalidateWorkspaceFeaturesCache();
      setGroups(body.groups ?? []);
      push('Feature overrides reset', 'success');
    } catch (error) {
      push(error instanceof Error ? error.message : 'Reset failed', 'error');
    } finally {
      setResetting(false);
    }
  }

  const hasOverrides = groups.some((group) =>
    group.features.some((feature) => feature.overridden),
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-none flex-col overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Features</h1>
          <p className="mt-1 text-xs text-text-muted">
            Turn workspace features on or off for your team. Core features stay available.
            Overrides apply only to this workspace.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resetting || !hasOverrides}
            onClick={() => void resetAll()}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {resetting ? 'Resetting' : 'Reset to platform defaults'}
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <p className="mb-4 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-muted">
          Only the workspace owner can change feature overrides. You can still view the current state.
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.category} className="rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-text-primary">{group.label}</h2>
              </div>
              <div className="divide-y divide-border px-4">
                {group.features.map((feature) => (
                  <div
                    key={feature.key}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">{feature.label}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{feature.description}</p>
                      <p className="mt-1 text-[11px] text-text-muted">{sourceLabel(feature)}</p>
                      {feature.overridden && canManage ? (
                        <button
                          type="button"
                          className="mt-1 text-[11px] text-accent hover:underline"
                          disabled={pendingKey === feature.key}
                          onClick={() => void clearOverride(feature)}
                        >
                          Use platform default
                        </button>
                      ) : null}
                    </div>
                    {feature.toggleable ? (
                      <Toggle
                        value={feature.enabled}
                        disabled={!canManage || pendingKey === feature.key || feature.source === 'platform_disabled'}
                        onChange={(enabled) => void setEnabled(feature, enabled)}
                      />
                    ) : (
                      <span className="rounded border border-border px-2 py-1 text-[11px] text-text-muted">
                        Always available
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
