'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Shield, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

type WebContextResponse = {
  mode: 'private' | 'hosted';
  activeProfile: string;
  profiles?: string[];
  profileScope?: {
    carinaHome: string;
    operatorSession: string;
    sessionPrefix: string;
  };
};

function scopeRows(ctx: WebContextResponse | null): Array<{ label: string; value: string }> {
  if (!ctx?.profileScope) return [];
  return [
    { label: 'CARINA_HOME', value: ctx.profileScope.carinaHome || 'Unavailable' },
    { label: 'Operator session', value: ctx.profileScope.operatorSession || 'Unavailable' },
    { label: 'Session prefix', value: ctx.profileScope.sessionPrefix || '(none)' },
  ];
}

export function ProfilesManager() {
  const [context, setContext] = useState<WebContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/web/context', { cache: 'no-store' });
      const data = (await res.json()) as WebContextResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Unable to load profiles');
      setContext(data);
    } catch (err) {
      setContext(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const profiles = useMemo(() => context?.profiles ?? [], [context]);
  const activeProfile = context?.activeProfile ?? 'default';
  const canSwitch = Boolean(context && context.mode === 'private' && profiles.length > 1);

  async function activate(name: string) {
    if (!context || name === context.activeProfile) return;
    const ok = window.confirm(
      `Switch Carina to profile "${name}"? This changes the current runtime scope for the private shell.`,
    );
    if (!ok) return;

    setSwitching(name);
    setError('');
    try {
      const res = await fetch('/api/web/context/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: name }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Unable to switch profile');
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwitching('');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">Profiles</h1>
            <p className="text-xs text-text-muted">
              View the active Carina profile, scope, and safe switch targets.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="min-h-0 border-r border-border bg-surface">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-medium text-text-primary">Current profile</h2>
            <p className="mt-1 text-xs text-text-muted">
              {context?.mode === 'private'
                ? 'Private shell profile switching is available here.'
                : 'Profile switching is not available in this shell.'}
            </p>
          </div>

          <div className="space-y-4 p-6">
            {loading ? (
              <EmptyState title="Loading profiles" subtitle="Reading the current workspace context." />
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{activeProfile}</CardTitle>
                    <Badge variant={context?.mode === 'private' ? 'active' : 'default'}>
                      {context?.mode === 'private' ? 'Private shell' : 'Hosted shell'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scopeRows(context).length > 0 ? (
                    scopeRows(context).map((item) => (
                      <div key={item.label} className="flex items-start gap-3">
                        <span className="min-w-28 text-xs text-text-muted">{item.label}</span>
                        <code className="break-all rounded bg-elevated px-2 py-1 text-xs text-text-primary">
                          {item.value}
                        </code>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-start gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-muted">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Profile scope data is not available from the current runtime.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="min-h-0">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-medium text-text-primary">Available profiles</h2>
            <p className="mt-1 text-xs text-text-muted">
              Switch only when you need a different workspace scope.
            </p>
          </div>

          <div className="space-y-3 p-6">
            {!loading && profiles.length === 0 ? (
              <EmptyState
                icon={<Shield className="h-5 w-5" />}
                title="No switchable profiles"
                subtitle={
                  context?.mode === 'private'
                    ? 'No alternate profiles are configured in this environment yet.'
                    : 'Profiles are only exposed in the private shell.'
                }
              />
            ) : (
              profiles.map((name) => {
                const active = name === activeProfile;
                return (
                  <Card key={name} className={cn(active && 'border-accent/40')}>
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-text-primary">{name}</p>
                          {active ? <Badge variant="active">Active</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          {active
                            ? 'This is the current runtime scope.'
                            : 'Switching changes CARINA_HOME and the active operator session for this shell.'}
                        </p>
                      </div>
                      <Button
                        variant={active ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => void activate(name)}
                        disabled={active || !canSwitch || switching === name}
                      >
                        <UserCog className="h-3.5 w-3.5" />
                        {active ? 'Current' : switching === name ? 'Switching...' : 'Switch'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
            {!loading && context?.mode !== 'private' ? (
              <div className="rounded-md border border-dashed border-border px-4 py-3 text-xs text-text-muted">
                Safe switching is disabled outside the private shell.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
