'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

type ModelRow = {
  provider: string;
  model: string;
  label: string;
};

export function WorkspaceModelsClient() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch('/api/models');
        const json = await response.json();
        if (!mounted) return;
        setModels(Array.isArray(json.data) ? json.data : []);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    return models.reduce<Record<string, ModelRow[]>>((acc, item) => {
      if (!acc[item.provider]) acc[item.provider] = [];
      acc[item.provider].push(item);
      return acc;
    }, {});
  }, [models]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-text-muted">
        <Spinner />
        <span>Loading models</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-text-muted">Models</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Model catalog</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Available providers and model options surfaced as a dedicated workspace page.
          </p>
        </div>
        <Link
          href="/settings/keys"
          className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
        >
          Manage keys
        </Link>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<Loader2 className="h-4 w-4 animate-spin" />}
              title="No models available"
              subtitle="Add provider keys in Settings to expose model options."
              action={
                <Link
                  href="/settings/keys"
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
                >
                  Add provider key
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(grouped).map(([provider, rows]) => (
            <Card key={provider}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="capitalize">{provider}</CardTitle>
                    <p className="mt-1 text-sm text-text-muted">
                      {rows.length} model{rows.length === 1 ? '' : 's'} available
                    </p>
                  </div>
                  <Bot className="h-5 w-5 text-accent" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {rows.map((row) => (
                  <div key={`${row.provider}:${row.model}`} className="rounded-lg border border-border bg-elevated/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">{row.label}</div>
                        <div className="text-xs text-text-muted">{row.model}</div>
                      </div>
                      <Badge variant="draft">{provider}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Provider keys</CardTitle>
              <p className="mt-1 text-sm text-text-muted">
                Models only appear after at least one provider key is configured in Settings.
              </p>
            </div>
            <KeyRound className="h-5 w-5 text-accent" />
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/settings/keys" className="text-sm text-accent hover:underline">
            Open Settings / Keys
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
