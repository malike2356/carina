'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, Newspaper } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type IncidentNewsletterMode = 'manual' | 'on_publish' | 'digest';

interface IncidentBlogAutomationSettings {
  researchEnabled: boolean;
  autoApproveEnabled: boolean;
  autoPublishEnabled: boolean;
  newsletterEnabled: boolean;
  newsletterMode: IncidentNewsletterMode;
  minSourcesForAutoApprove: number;
  minSourcesForAutoPublish: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

const DEFAULT_INCIDENT_BLOG_SETTINGS: IncidentBlogAutomationSettings = {
  researchEnabled: true,
  autoApproveEnabled: false,
  autoPublishEnabled: false,
  newsletterEnabled: true,
  newsletterMode: 'manual',
  minSourcesForAutoApprove: 2,
  minSourcesForAutoPublish: 3,
  updatedAt: null,
  updatedBy: null,
};

function Toggle({
  value,
  onChange,
  label,
  description,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary">{label}</p>
        {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          value ? 'bg-accent' : 'border-border bg-elevated',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            value ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs transition-colors',
            value === option.value
              ? 'border-accent/40 bg-accent-dim text-accent'
              : 'border-border bg-elevated text-text-secondary hover:text-text-primary',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function IncidentBlogAutomationDashboard() {
  const { push } = useToast();
  const [settings, setSettings] = useState<IncidentBlogAutomationSettings>(
    DEFAULT_INCIDENT_BLOG_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/incident-blog/admin/settings')
      .then((response) => response.json())
      .then((data) => {
        if (!data.settings) return;
        setSettings({
          researchEnabled:
            typeof data.settings.researchEnabled === 'boolean'
              ? data.settings.researchEnabled
              : DEFAULT_INCIDENT_BLOG_SETTINGS.researchEnabled,
          autoApproveEnabled:
            typeof data.settings.autoApproveEnabled === 'boolean'
              ? data.settings.autoApproveEnabled
              : DEFAULT_INCIDENT_BLOG_SETTINGS.autoApproveEnabled,
          autoPublishEnabled:
            typeof data.settings.autoPublishEnabled === 'boolean'
              ? data.settings.autoPublishEnabled
              : DEFAULT_INCIDENT_BLOG_SETTINGS.autoPublishEnabled,
          newsletterEnabled:
            typeof data.settings.newsletterEnabled === 'boolean'
              ? data.settings.newsletterEnabled
              : DEFAULT_INCIDENT_BLOG_SETTINGS.newsletterEnabled,
          newsletterMode:
            data.settings.newsletterMode === 'on_publish' || data.settings.newsletterMode === 'digest'
              ? data.settings.newsletterMode
              : DEFAULT_INCIDENT_BLOG_SETTINGS.newsletterMode,
          minSourcesForAutoApprove:
            typeof data.settings.minSourcesForAutoApprove === 'number'
              ? data.settings.minSourcesForAutoApprove
              : DEFAULT_INCIDENT_BLOG_SETTINGS.minSourcesForAutoApprove,
          minSourcesForAutoPublish:
            typeof data.settings.minSourcesForAutoPublish === 'number'
              ? data.settings.minSourcesForAutoPublish
              : DEFAULT_INCIDENT_BLOG_SETTINGS.minSourcesForAutoPublish,
          updatedAt: typeof data.settings.updatedAt === 'string' ? data.settings.updatedAt : null,
          updatedBy: typeof data.settings.updatedBy === 'string' ? data.settings.updatedBy : null,
        });
      })
      .catch(() => {
        push('Could not load incident blog settings.', 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [push]);

  async function saveSettings(
    patch: Partial<IncidentBlogAutomationSettings> & { updatedBy?: string },
  ) {
    setSaving(true);
    setSaved(false);
    try {
      const next = {
        researchEnabled: patch.researchEnabled ?? settings.researchEnabled,
        autoApproveEnabled: patch.autoApproveEnabled ?? settings.autoApproveEnabled,
        autoPublishEnabled: patch.autoPublishEnabled ?? settings.autoPublishEnabled,
        newsletterEnabled: patch.newsletterEnabled ?? settings.newsletterEnabled,
        newsletterMode: patch.newsletterMode ?? settings.newsletterMode,
        minSourcesForAutoApprove: patch.minSourcesForAutoApprove ?? settings.minSourcesForAutoApprove,
        minSourcesForAutoPublish: patch.minSourcesForAutoPublish ?? settings.minSourcesForAutoPublish,
      };
      setSettings((current) => ({ ...current, ...next }));

      const response = await fetch('/api/incident-blog/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...next,
          updatedBy: patch.updatedBy ?? 'ops',
        }),
      });
      const body = (await response.json()) as {
        settings?: IncidentBlogAutomationSettings;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? 'Could not update incident blog settings');
      }
      if (body.settings) {
        setSettings(body.settings);
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      push(error instanceof Error ? error.message : 'Could not update incident blog settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-center px-4 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/settings" className="text-xs text-accent hover:underline">
          Back to settings
        </Link>
        {saving || saved ? (
          <span
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              saving ? 'bg-elevated text-text-secondary' : 'bg-accent text-black',
            )}
          >
            {saving ? 'Saving...' : 'Saved'}
          </span>
        ) : null}
      </div>

      <div className="mb-6 flex items-start gap-3">
        <Newspaper className="mt-0.5 h-6 w-6 text-text-secondary" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Incident blog dashboard</h1>
          <p className="mt-1 text-xs text-text-muted">
            Control incident discovery, auto-approval, publish thresholds, and subscriber dispatch in one place.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-surface px-4">
          <div className="divide-y divide-border">
            <Toggle
              label="Enable incident research"
              description="Run automated discovery jobs for new AI and agent incidents."
              value={settings.researchEnabled}
              onChange={(value) => void saveSettings({ researchEnabled: value })}
            />
            <Toggle
              label="Auto-approve drafts"
              description="Move source-backed drafts to approved once they clear the threshold."
              value={settings.autoApproveEnabled}
              onChange={(value) => void saveSettings({ autoApproveEnabled: value })}
            />
            <Toggle
              label="Auto-publish approved items"
              description="Publish stronger drafts automatically when source depth is high enough."
              value={settings.autoPublishEnabled}
              onChange={(value) => void saveSettings({ autoPublishEnabled: value })}
            />
            <Toggle
              label="Enable subscriber newsletter"
              description="Send publish notifications and digests to confirmed subscribers."
              value={settings.newsletterEnabled}
              onChange={(value) => void saveSettings({ newsletterEnabled: value })}
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface px-4 py-4">
          <label className="block text-sm text-text-primary">
            Minimum sources for auto-approve
            <span className="ml-2 text-accent">{settings.minSourcesForAutoApprove}</span>
          </label>
          <p className="mt-0.5 text-xs text-text-muted">
            Require at least this many source URLs before a draft is auto-approved.
          </p>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={settings.minSourcesForAutoApprove}
            onChange={(e) =>
              void saveSettings({ minSourcesForAutoApprove: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-3 w-full accent-accent"
          />
        </section>

        <section className="rounded-lg border border-border bg-surface px-4 py-4">
          <label className="block text-sm text-text-primary">
            Minimum sources for auto-publish
            <span className="ml-2 text-accent">{settings.minSourcesForAutoPublish}</span>
          </label>
          <p className="mt-0.5 text-xs text-text-muted">
            Require at least this many source URLs before a draft can publish automatically.
          </p>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={settings.minSourcesForAutoPublish}
            onChange={(e) =>
              void saveSettings({ minSourcesForAutoPublish: Math.max(1, Number(e.target.value) || 1) })
            }
            className="mt-3 w-full accent-accent"
          />
        </section>

        <section className="rounded-lg border border-border bg-surface px-4 py-4">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Newsletter mode</h2>
          <RadioGroup
            value={settings.newsletterMode}
            onChange={(value) => void saveSettings({ newsletterMode: value })}
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'on_publish', label: 'On publish' },
              { value: 'digest', label: 'Digest' },
            ]}
          />
          <p className="mt-3 text-xs text-text-muted">
            Manual keeps dispatch operator-led. On publish sends when incidents go live. Digest groups send work.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-surface px-4 py-4 text-xs text-text-muted">
          <p className="font-medium text-text-secondary">Last saved</p>
          <p className="mt-1">
            {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'Not saved yet'}
          </p>
          {settings.updatedBy ? <p className="mt-1">Updated by {settings.updatedBy}</p> : null}
        </section>
      </div>
    </div>
  );
}
