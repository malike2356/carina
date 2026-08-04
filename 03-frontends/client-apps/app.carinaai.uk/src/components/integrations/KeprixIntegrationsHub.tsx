'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectorSummary = {
  id: string;
  label: string;
  category: string;
  description: string;
  auth_pattern: string;
  featured?: boolean;
  docs_url?: string;
  install_status?: { installed: boolean };
};

type CatalogResponse = {
  configured?: boolean;
  stub?: boolean;
  error?: string;
  message?: string;
  connectors?: ConnectorSummary[];
  categories?: Array<{ id: string; label: string; count: number }>;
};

type TabId = 'tools' | 'channels';

export function KeprixIntegrationsHub() {
  const [tab, setTab] = useState<TabId>('tools');
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [categories, setCategories] = useState<CatalogResponse['categories']>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [banner, setBanner] = useState('');
  const [bannerError, setBannerError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConnectorSummary | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search.trim()) params.set('q', search.trim());
    try {
      const res = await fetch(`/api/integrations/catalog?${params.toString()}`);
      const data = (await res.json()) as CatalogResponse;
      if (!data.configured) {
        setBanner(data.message ?? 'Integrations catalog is not configured.');
        setBannerError(true);
        setConnectors([]);
        return;
      }
      if (data.error) {
        setBanner(data.error);
        setBannerError(true);
      } else if (data.stub) {
        setBanner('Showing stub catalog (Keprix API unreachable or stub mode enabled).');
        setBannerError(false);
      } else {
        setBanner('');
        setBannerError(false);
      }
      setConnectors(data.connectors ?? []);
      setCategories(data.categories ?? []);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Failed to load catalog');
      setBannerError(true);
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCatalog();
    }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog, search]);

  async function handoff(connectorId: string, action: 'install' | 'studio') {
    const res = await fetch('/api/integrations/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connector_id: connectorId, action }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setBanner(data.error ?? 'Handoff failed');
      setBannerError(true);
      return;
    }
    window.open(data.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs',
            tab === 'tools' ? 'border-accent text-accent' : 'border-border text-text-secondary',
          )}
          onClick={() => setTab('tools')}
        >
          Data and tools
        </button>
        <button
          type="button"
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs',
            tab === 'channels' ? 'border-accent text-accent' : 'border-border text-text-secondary',
          )}
          onClick={() => setTab('channels')}
        >
          Worker channels
        </button>
      </div>

      {tab === 'channels' ? (
        <div className="rounded-lg border border-border bg-elevated p-4 text-sm text-text-secondary">
          <p>
            Worker channels (WhatsApp, email, Slack, social) are configured per Aiva worker.
            Use the Channels tab on each worker or the workspace channels page.
          </p>
          <Link href="/channels" className="btn-primary mt-3 inline-flex text-xs">
            Open channels
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            {connectors.length > 0 ? `${connectors.length}+ connectors` : 'Connectors'} for visual
            playbooks. Worker messaging stays in Aiva channels.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search connectors"
              className="rounded-md border border-border bg-elevated px-3 py-1.5 text-xs"
            />
            <button
              type="button"
              className="btn-ghost inline-flex items-center gap-1 text-xs"
              onClick={() => void loadCatalog()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px]',
                !category ? 'border-accent text-accent' : 'border-border text-text-muted',
              )}
              onClick={() => setCategory('')}
            >
              All
            </button>
            {(categories ?? []).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px]',
                  category === cat.id ? 'border-accent text-accent' : 'border-border text-text-muted',
                )}
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {banner ? (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-xs',
                bannerError ? 'border-red-400/40 text-red-300' : 'border-border text-text-muted',
              )}
            >
              {banner}
            </div>
          ) : null}
          {loading ? (
            <p className="text-xs text-text-muted">Loading catalog...</p>
          ) : connectors.length === 0 ? (
            <p className="text-xs text-text-muted">No connectors match your filters.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {connectors.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="rounded-lg border border-border bg-elevated p-4 text-left hover:border-accent/50"
                  onClick={() => setSelected(row)}
                >
                  <p className="text-sm font-medium text-text-primary">{row.label}</p>
                  <p className="mt-1 text-xs text-text-muted">{row.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
                      {row.category}
                    </span>
                    {row.auth_pattern === 'sidecar' ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
                        Sidecar bridge
                      </span>
                    ) : null}
                    {row.install_status?.installed ? (
                      <span className="rounded-full border border-green-400/40 px-2 py-0.5 text-[10px] text-green-300">
                        Installed
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
          {selected ? (
            <div className="rounded-lg border border-border bg-elevated p-4">
              <p className="text-sm font-medium text-text-primary">{selected.label}</p>
              <p className="mt-1 text-xs text-text-muted">{selected.description}</p>
              {selected.id === 'n8n_sidecar' ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Migrate workflows with <code className="text-[11px]">keprix migrate from-n8n</code>.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={() => void handoff(selected.id, 'install')}
                >
                  Install
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => void handoff(selected.id, 'studio')}
                >
                  Use in playbook
                </button>
                {selected.docs_url ? (
                  <a
                    href={selected.docs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost inline-flex items-center gap-1 text-xs"
                  >
                    Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          <p className="text-[11px] text-text-muted">Connectors powered by Keprix.</p>
        </>
      )}
    </div>
  );
}
