'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BrandConfig } from '@/lib/brand';
import { normalizeBrandConfig } from '@/lib/brand';
import { whiteLabelDocPath } from '@/lib/docs-links';

const BRAND_FIELDS: Array<{ key: keyof BrandConfig; label: string; placeholder: string }> = [
  { key: 'productName', label: 'Product name', placeholder: 'Acme Agents' },
  { key: 'shortName', label: 'Short name', placeholder: 'Acme' },
  { key: 'publicSiteTitle', label: 'Browser title', placeholder: 'Acme Agents Cloud' },
  { key: 'logoUrl', label: 'Logo URL', placeholder: 'https://cdn.example/logo.svg' },
  { key: 'faviconUrl', label: 'Favicon URL', placeholder: 'https://cdn.example/favicon.ico' },
  { key: 'supportEmail', label: 'Support email', placeholder: 'help@example.com' },
  { key: 'supportName', label: 'Support name', placeholder: 'Acme Support' },
  { key: 'senderName', label: 'Email sender name', placeholder: 'Acme Agents' },
  { key: 'senderEmail', label: 'Email sender address', placeholder: 'noreply@example.com' },
];

interface BrandSettingsProps {
  brand: BrandConfig;
  isOwner: boolean;
  onSave: (patch: BrandConfig) => Promise<void>;
}

export function BrandSettings({ brand, isOwner, onSave }: BrandSettingsProps) {
  const [draft, setDraft] = useState<BrandConfig>(normalizeBrandConfig(brand));
  const [accent, setAccent] = useState(brand.colorTokens?.['--accent'] ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(normalizeBrandConfig(brand));
    setAccent(brand.colorTokens?.['--accent'] ?? '');
  }, [brand]);

  async function handleSave() {
    setSaving(true);
    const patch: BrandConfig = { ...draft };
    if (accent.trim()) {
      patch.colorTokens = { ...(draft.colorTokens ?? {}), '--accent': accent.trim() };
    }
    await onSave(patch);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-base font-semibold text-text-primary">Brand</h1>
        <p className="text-xs text-text-muted">
          White-label identity for login, billing, email, and the workspace shell.{' '}
          <a
            href={whiteLabelDocPath('getting-started')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Read the handoff guide
          </a>
        </p>
      </div>

      {!isOwner ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-text-muted">
          Only the workspace owner can edit brand settings.
        </p>
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          {BRAND_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">{field.label}</label>
              <input
                value={String(draft[field.key] ?? '')}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                }
                placeholder={field.placeholder}
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
              />
            </div>
          ))}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Accent color</label>
            <input
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              placeholder="#16c97e"
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save brand'}
            </button>
            <a
              href={whiteLabelDocPath('custom-domains')}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
            >
              Custom domain guide
            </a>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4 text-xs text-text-muted">
        <p className="mb-2 font-medium text-text-secondary">Operator docs</p>
        <ul className="space-y-1">
          <li>
            <a href={whiteLabelDocPath('branding')} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Branding reference
            </a>
          </li>
          <li>
            <a href={whiteLabelDocPath('customer-handoff')} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Customer handoff checklist
            </a>
          </li>
          <li>
            <a href={whiteLabelDocPath('support-and-troubleshooting')} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Support and troubleshooting
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
