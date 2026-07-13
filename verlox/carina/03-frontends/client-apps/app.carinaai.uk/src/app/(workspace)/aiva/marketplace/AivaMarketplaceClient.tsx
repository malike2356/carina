'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { cn } from '@/lib/utils';

type MarketplaceTemplate = {
  templateId: string;
  name: string;
  icon: string;
  tagline: string;
  tierLabel: string;
  features: string[];
  setupTimeSeconds: number;
  useCaseExample: string;
};

type TemplateDetail = MarketplaceTemplate & {
  description: string;
  tools: string[];
  skills: string[];
  slotLimit: number | null;
  greeting: string;
};

const ICON_MAP: Record<string, string> = {
  building: 'ti-building',
  headphones: 'ti-headphones',
  mail: 'ti-mail',
  receipt: 'ti-receipt',
  calendar: 'ti-calendar',
};

export function AivaMarketplaceClient() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [selected, setSelected] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/aiva/marketplace/templates');
      const data = (await res.json()) as { templates?: MarketplaceTemplate[] };
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  async function openDetail(templateId: string) {
    setError(null);
    const res = await fetch(`/api/aiva/marketplace/templates/${encodeURIComponent(templateId)}`);
    const data = (await res.json()) as { template?: TemplateDetail };
    if (data.template) setSelected(data.template);
  }

  async function getStarted(templateId: string) {
    setProvisioning(true);
    setError(null);
    try {
      const res = await fetch('/api/aiva/marketplace/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const data = (await res.json()) as {
        error?: string;
        checkoutUrl?: string;
        workerId?: string;
        status?: string;
      };
      if (res.status === 402 && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'Provisioning failed');
        return;
      }
      if (data.workerId) {
        router.push(`/aiva/workers/${data.workerId}`);
        return;
      }
      router.push(`/aiva?template=${encodeURIComponent(templateId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Agent marketplace"
        description="Pre-built AI workers. Pick a template, provision in under a minute. Prices via Stripe on your plan page."
        actions={
          <Link href="/aiva/provision" className="btn-ghost text-xs">
            Create custom worker
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-300">{error}</div>
        ) : null}
        {loading ? (
          <p className="text-xs text-text-muted">Loading templates...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((row) => (
              <article
                key={row.templateId}
                className="rounded-lg border border-border bg-elevated p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium text-text-primary">{row.name}</h2>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
                    {row.tierLabel}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{row.tagline}</p>
                <p className="mt-2 text-[11px] text-text-muted">
                  Setup about {row.setupTimeSeconds}s. Scout protection included.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => void openDetail(row.templateId)}
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={provisioning}
                    onClick={() => void getStarted(row.templateId)}
                  >
                    Get started
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {selected ? (
          <div className="mt-6 rounded-lg border border-border bg-elevated p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-text-primary">{selected.name}</h3>
              <button type="button" className="btn-ghost text-xs" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p className="text-xs text-text-secondary">{selected.description}</p>
            <ul className="mt-3 space-y-1 text-xs text-text-muted">
              {selected.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-text-muted">
              Plan: {selected.tierLabel}
              {selected.slotLimit != null ? ` (up to ${selected.slotLimit} workers)` : ' (custom worker allowance)'}
            </p>
            <p className="mt-2 text-xs italic text-text-secondary">{selected.useCaseExample}</p>
            <button
              type="button"
              className={cn('btn-primary mt-3 text-xs')}
              disabled={provisioning}
              onClick={() => void getStarted(selected.templateId)}
            >
              Get started
            </button>
          </div>
        ) : null}
        <p className="mt-6 text-[11px] text-text-muted">
          All plans include Scout protection. Prices via Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
