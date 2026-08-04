'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

type WorkspaceConfigResponse = {
  hosted: boolean;
  authenticated: boolean;
  product: string;
  surface: string;
  hostname?: string;
  workspace?: {
    id?: string;
    plan?: string;
    name?: string;
    slug?: string;
  };
  features: Record<string, boolean>;
};

export function WorkspaceConfigClient() {
  const [data, setData] = useState<WorkspaceConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch('/api/config');
        const json = await response.json();
        if (!mounted) return;
        setData(json as WorkspaceConfigResponse);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-text-muted">
        <Spinner />
        <span>Loading config</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-text-muted">Config</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Workspace config</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Runtime feature flags and product state exposed as a first-class product page.
          </p>
        </div>
        <Link
          href="/settings/features"
          className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
        >
          Feature settings
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Runtime summary</CardTitle>
            <p className="text-sm text-text-muted">Current product, surface, and auth state.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow label="Product" value={data?.product ?? 'unknown'} />
            <SummaryRow label="Surface" value={data?.surface ?? 'unknown'} />
            <SummaryRow label="Authenticated" value={data?.authenticated ? 'yes' : 'no'} />
            <SummaryRow label="Hosted" value={data?.hosted ? 'yes' : 'no'} />
            {data?.workspace?.name ? <SummaryRow label="Workspace" value={data.workspace.name} /> : null}
            {data?.workspace?.plan ? <SummaryRow label="Plan" value={data.workspace.plan} /> : null}
            {data?.hostname ? <SummaryRow label="Hostname" value={data.hostname} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
            <p className="text-sm text-text-muted">API response for the product contract.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {data ? (
              Object.entries(data.features ?? {}).map(([name, enabled]) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated/40 px-3 py-2"
                >
                  <span className="text-sm text-text-primary">{name}</span>
                  <Badge variant={enabled ? 'active' : 'paused'}>
                    {enabled ? 'enabled' : 'disabled'}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState title="No config returned" subtitle="The config API did not return a response." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-elevated/40 px-3 py-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className="text-xs text-text-primary">{value}</span>
    </div>
  );
}
