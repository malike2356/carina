'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import {
  getIntegrationGuide,
  type IntegrationGuideId,
} from '@/lib/integration-guides';
import type { GuideCopyItem } from '@/lib/integration-guides/types';
import { cn } from '@/lib/utils';

type IntegrationGuideDrawerProps = {
  guideId: IntegrationGuideId;
  open: boolean;
  onClose: () => void;
};

const GOOGLE_GUIDE_IDS = new Set<IntegrationGuideId>([
  'google-drive',
  'google-gmail',
  'google-calendar',
  'google-tools',
]);

type GoogleGuideMode = 'platform' | 'byok' | 'unknown';

function CopyRow({ item }: { item: GuideCopyItem }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback for older browsers / denied clipboard
      const area = document.createElement('textarea');
      area.value = item.value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-elevated/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          {item.label}
        </p>
        <button
          type="button"
          onClick={() => void copy()}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium',
            copied
              ? 'bg-emerald-500/15 text-text-primary'
              : 'bg-accent/60 text-text-primary hover:bg-accent',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className="block break-all rounded-lg bg-base px-2.5 py-2 text-[11px] leading-relaxed text-text-primary">
        {item.value}
      </code>
      {item.hint ? <p className="mt-1.5 text-[11px] text-text-muted">{item.hint}</p> : null}
    </div>
  );
}

export function IntegrationGuideDrawer({
  guideId,
  open,
  onClose,
}: IntegrationGuideDrawerProps) {
  const guide = useMemo(() => (open ? getIntegrationGuide(guideId) : null), [guideId, open]);
  const [googleMode, setGoogleMode] = useState<GoogleGuideMode>('unknown');

  const isGoogleGuide = GOOGLE_GUIDE_IDS.has(guideId);
  const isPlatformMode = googleMode === 'platform';
  const isByokMode = googleMode === 'byok';

  const visibleSteps = useMemo(() => {
    if (!guide) return [];
    if (!isGoogleGuide || googleMode === 'unknown') return guide.steps;

    const normalSteps = guide.steps.slice(0, 3);
    const advancedSteps = guide.steps.slice(3);

    return isByokMode ? advancedSteps : normalSteps;
  }, [guide, isGoogleGuide, isByokMode, googleMode]);

  const finishText = useMemo(() => {
    if (!guide) return '';
    if (!isGoogleGuide || googleMode === 'unknown') return guide.finish;
    if (isByokMode) {
      return 'After the Advanced steps, return to Calendar settings and click Connect with Google using your BYOK Google client.';
    }
    return guide.finish;
  }, [guide, isGoogleGuide, isByokMode, googleMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !isGoogleGuide) {
      setGoogleMode('unknown');
      return;
    }

    const controller = new AbortController();

    async function detectGoogleMode() {
      try {
        const response = await fetch('/api/calendar/connection', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          setGoogleMode('unknown');
          return;
        }

        const data = (await response.json()) as {
          data?: {
            provider?: string;
            clientId?: string | null;
          } | null;
          platformGoogleConfigured?: boolean;
        };

        const connection = data.data ?? null;
        const hasClientId = Boolean(connection?.clientId?.trim());
        const platformGoogleConfigured = Boolean(data.platformGoogleConfigured);

        if (hasClientId) {
          setGoogleMode('byok');
          return;
        }

        if (platformGoogleConfigured) {
          setGoogleMode('platform');
          return;
        }

        if (connection?.provider === 'google') {
          setGoogleMode('byok');
          return;
        }

        setGoogleMode('unknown');
      } catch {
        setGoogleMode('unknown');
      }
    }

    void detectGoogleMode();
    return () => controller.abort();
  }, [guideId, isGoogleGuide, open]);

  if (!open || !guide) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/50" role="presentation">
      <button
        type="button"
        aria-label="Close guide"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="integration-guide-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-base text-text-primary shadow-xl sm:max-w-lg"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Guide me · about {guide.estimatedMinutes} min
            </p>
            <h2
              id="integration-guide-title"
              className="mt-1 text-lg font-semibold leading-snug text-text-primary"
            >
              {guide.title}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{guide.subtitle}</p>
            {isGoogleGuide ? (
              <p className="mt-2 inline-flex rounded-full border border-border bg-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                {isPlatformMode
                  ? 'Detected: platform Google app; showing the normal path.'
                  : isByokMode
                    ? 'Detected: BYOK Google client; showing the Advanced path.'
                    : 'Could not confirm Google mode; showing both paths.'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-elevated hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <ol className="space-y-5">
            {visibleSteps.map((step, index) => (
              <li key={`${guide.id}-${index}`} className="relative pl-10">
                <span
                  className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{step.body}</p>
                {step.tip ? (
                  <p className="mt-2 rounded-lg border border-border bg-elevated px-3 py-2 text-xs leading-relaxed text-text-primary">
                    <span className="font-semibold text-text-secondary">Tip:</span> {step.tip}
                  </p>
                ) : null}
                {step.links && step.links.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.links.map((link) => (
                      <a
                        key={link.href + link.label}
                        href={link.href}
                        target={link.href.startsWith('http') ? '_blank' : undefined}
                        rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-muted"
                      >
                        {link.label}
                        {link.href.startsWith('http') ? (
                          <ExternalLink className="h-3.5 w-3.5" />
                        ) : null}
                      </a>
                    ))}
                  </div>
                ) : null}
                {step.copyItems && step.copyItems.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {step.copyItems.map((item) => (
                      <CopyRow key={item.value} item={item} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-2xl border border-border bg-muted px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Done when</p>
            <p className="mt-1 text-sm leading-relaxed text-text-primary">{finishText}</p>
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            Close guide
          </button>
        </div>
      </aside>
    </div>
  );
}
