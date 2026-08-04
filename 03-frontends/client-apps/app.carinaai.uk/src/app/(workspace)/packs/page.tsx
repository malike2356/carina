'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Package, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

type StorefrontPack = {
  slug: string;
  name: string;
  description: string;
  version: string;
  category?: string;
  ownership: 'platform' | 'reseller' | 'customer';
  installed: boolean;
  label?: string;
};

type VerticalTemplate = {
  id: string;
  name: string;
  description: string;
  packs: string[];
  featured?: boolean;
};

type Storefront = {
  productName: string;
  marketplaceEnabled: boolean;
  templates: VerticalTemplate[];
  packs: StorefrontPack[];
  activePacks: string[];
};

const OWNERSHIP_LABELS: Record<StorefrontPack['ownership'], string> = {
  platform: 'Platform',
  reseller: 'Partner',
  customer: 'Workspace',
};

export default function PacksPage() {
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch('/api/marketplace/storefront');
    const data = await response.json();
    if (data.data) setStorefront(data.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function installTemplate(templateId: string) {
    setBusy(`template:${templateId}`);
    await fetch(`/api/marketplace/templates/${templateId}/install`, { method: 'POST' });
    await load();
    setBusy(null);
  }

  async function togglePack(slug: string, enabled: boolean) {
    setBusy(`pack:${slug}`);
    await fetch(`/api/marketplace/packs/${encodeURIComponent(slug)}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    await load();
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-base">
        <Spinner />
      </div>
    );
  }

  if (!storefront) {
    return (
      <div className="flex h-full items-center justify-center bg-base">
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="Pack storefront unavailable"
          subtitle="Sign in and try again."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-base">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Skill packs</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Vertical templates and domain packs for {storefront.productName}
        </p>
      </div>

      {storefront.templates.length > 0 && (
        <section className="border-b border-border px-6 py-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-medium text-text-primary">Starter bundles</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {storefront.templates.map((template) => (
              <div
                key={template.id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{template.name}</span>
                  {template.featured && (
                    <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] text-accent">
                      Featured
                    </span>
                  )}
                </div>
                <p className="mb-3 text-xs leading-relaxed text-text-muted">{template.description}</p>
                <p className="mb-3 text-[10px] text-text-muted">
                  Includes: {template.packs.join(', ')}
                </p>
                <button
                  type="button"
                  disabled={busy === `template:${template.id}`}
                  onClick={() => void installTemplate(template.id)}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40"
                >
                  {busy === `template:${template.id}` ? 'Installing...' : 'Install bundle'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-6 py-5">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-medium text-text-primary">Pack library</h2>
        </div>
        {storefront.packs.length === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="No packs available"
            subtitle="Your deployment may be self-hosted without a marketplace catalog."
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {storefront.packs.map((pack) => (
              <div key={pack.slug} className="flex items-start gap-4 px-4 py-4">
                <button
                  type="button"
                  disabled={busy === `pack:${pack.slug}`}
                  onClick={() => void togglePack(pack.slug, !pack.installed)}
                  className="mt-0.5 shrink-0 text-text-muted hover:text-accent"
                  aria-label={pack.installed ? 'Disable pack' : 'Enable pack'}
                >
                  {pack.installed ? (
                    <ToggleRight className="h-5 w-5 text-accent" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{pack.name}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
                      {OWNERSHIP_LABELS[pack.ownership]}
                    </span>
                    {pack.category && (
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] capitalize text-text-muted">
                        {pack.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-text-muted">{pack.description}</p>
                  <p className="mt-1 text-[10px] text-text-muted">v{pack.version}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-[11px] text-text-muted">
          Installed packs shape domain context in chat. Custom cloud skills remain in the{' '}
          <Link href="/settings" className="text-accent hover:underline">
            skills panel
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
