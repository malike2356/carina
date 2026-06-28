'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { WidgetPreview } from '@/components/settings/WidgetPreview';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useToast } from '@/components/ui/Toast';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';

const DEFAULT_BRANDING = {
  primaryColor: '#1a5f7a',
  companyName: null as string | null,
  hideVerloxAttribution: false,
};

interface BrandingState {
  logoUrl: string | null;
  primaryColor: string;
  companyName: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  hideVerloxAttribution: boolean;
}

const HEX_PARTIAL = /^#[0-9a-fA-F]{0,6}$/;
const HEX_FULL = /^#[0-9a-fA-F]{6}$/;

export default function BrandingSettingsPage() {
  const { push } = useToast();
  const [branding, setBranding] = useState<BrandingState>({
    logoUrl: null,
    ...DEFAULT_BRANDING,
    customDomain: null,
    customDomainVerified: false,
  });
  const [planTier, setPlanTier] = useState('trial');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dnsToken, setDnsToken] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace/branding');
      if (!res.ok) throw new Error('Failed to load branding');
      const body = (await res.json()) as { branding: BrandingState; planTier?: string };
      setBranding(body.branding);
      setPlanTier(body.planTier ?? 'trial');
    } catch {
      push('Could not load branding settings.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePatch(patch: Partial<BrandingState>) {
    setSaving(true);
    try {
      const res = await fetch('/api/workspace/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = (await res.json()) as { branding?: BrandingState; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Save failed');
      if (body.branding) setBranding(body.branding);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      push('Branding saved', 'success');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result ?? '');
      const base64 = data.includes(',') ? data.split(',')[1] : data;
      setSaving(true);
      try {
        const res = await fetch('/api/workspace/branding/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64, mimeType: file.type }),
        });
        const body = (await res.json()) as { logoUrl?: string; error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Upload failed');
        setBranding((prev) => ({ ...prev, logoUrl: body.logoUrl ?? null }));
        push('Logo uploaded', 'success');
      } catch (err) {
        push(err instanceof Error ? err.message : 'Upload failed', 'error');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function removeLogo() {
    setSaving(true);
    try {
      const res = await fetch('/api/workspace/branding/logo', { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setBranding((prev) => ({ ...prev, logoUrl: null }));
      push('Logo removed', 'success');
    } catch {
      push('Could not remove logo.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function verifyDomain() {
    setSaving(true);
    try {
      const res = await fetch('/api/workspace/branding/verify-domain', { method: 'POST' });
      const body = (await res.json()) as { verified?: boolean; message?: string; cnameExpected?: string };
      if (body.cnameExpected) setDnsToken(body.cnameExpected);
      if (body.verified) {
        setBranding((prev) => ({ ...prev, customDomainVerified: true }));
        setVerifyMessage('Verified');
        push('Domain verified', 'success');
      } else {
        setVerifyMessage('Not found');
        push(body.message ?? 'CNAME record not found yet.', 'info');
      }
    } catch {
      push('Verification failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setBranding((prev) => ({
      ...prev,
      primaryColor: DEFAULT_BRANDING.primaryColor,
      companyName: DEFAULT_BRANDING.companyName,
      hideVerloxAttribution: DEFAULT_BRANDING.hideVerloxAttribution,
    }));
    void savePatch(DEFAULT_BRANDING);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <Link href="/settings" className="text-xs text-accent hover:underline">
          Back to settings
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-text-primary">Widget branding</h1>
        <p className="mt-1 text-sm text-text-muted">
          Customize the web chat widget and portal appearance for your customers.
        </p>
      </div>

      <PlanGateSection planRequired="business" currentPlan={planTier}>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Logo</h2>
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-elevated">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <span className="text-xs text-text-muted">No logo</span>
                  )}
                </div>
                <div>
                  <label htmlFor="logo-file" className="cursor-pointer text-sm font-medium text-accent hover:underline">
                    {branding.logoUrl ? 'Replace logo' : 'Upload logo'}
                  </label>
                  <input
                    id="logo-file"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleLogoUpload(file);
                    }}
                  />
                  {branding.logoUrl ? (
                    <button
                      type="button"
                      onClick={() => void removeLogo()}
                      className="mt-1 block text-[11px] text-red-400 hover:text-red-300"
                    >
                      Remove logo
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Colors and name</h2>
              <label className="block text-xs text-text-muted">Company name (widget header)</label>
              <input
                className={AIVA_INPUT_CLASS}
                value={branding.companyName ?? ''}
                onChange={(e) => setBranding((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="Your company name"
              />
              <label className="block text-xs text-text-muted">Primary color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Primary brand color"
                  value={HEX_FULL.test(branding.primaryColor) ? branding.primaryColor : '#1a5f7a'}
                  onChange={(e) => setBranding((prev) => ({ ...prev, primaryColor: e.target.value }))}
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
                />
                <input
                  className={AIVA_INPUT_CLASS}
                  value={branding.primaryColor}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (HEX_PARTIAL.test(next)) {
                      setBranding((prev) => ({ ...prev, primaryColor: next }));
                    }
                  }}
                  placeholder="#1a5f7a"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-secondary">Hide &quot;Powered by VERLOX&quot; footer</span>
                <ToggleSwitch
                  checked={branding.hideVerloxAttribution}
                  onChange={(next) =>
                    setBranding((prev) => ({
                      ...prev,
                      hideVerloxAttribution: next,
                    }))
                  }
                  label="Hide VERLOX attribution"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Custom domain</h2>
              <input
                className={AIVA_INPUT_CLASS}
                value={branding.customDomain ?? ''}
                onChange={(e) =>
                  setBranding((prev) => ({
                    ...prev,
                    customDomain: e.target.value,
                    customDomainVerified: false,
                  }))
                }
                placeholder="chat.yourdomain.com"
              />
              {dnsToken || branding.customDomain ? (
                <div className="rounded-lg border border-border bg-overlay/50 p-3 text-xs text-text-muted">
                  <p className="mb-2 font-medium text-text-secondary">DNS instructions</p>
                  <div className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
                    <span className="text-text-muted">Type</span>
                    <span>CNAME</span>
                    <span className="text-text-muted">Host</span>
                    <span>{branding.customDomain || 'chat.yourdomain.com'}</span>
                    <span className="text-text-muted">Value</span>
                    <span className="break-all">{dnsToken || 'carina-verify=...'}</span>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void savePatch({ customDomain: branding.customDomain })}
                  className="rounded-md border border-border px-3 py-2 text-sm text-text-primary hover:bg-overlay"
                >
                  Save domain
                </button>
                <button
                  type="button"
                  disabled={saving || !branding.customDomain}
                  onClick={() => void verifyDomain()}
                  className="rounded-md border border-border px-3 py-2 text-sm text-text-primary hover:bg-overlay"
                >
                  Verify DNS
                </button>
                {branding.customDomainVerified ? (
                  <span className="text-xs text-green-400">Verified</span>
                ) : verifyMessage === 'Not found' ? (
                  <span className="text-xs text-amber-400">Not found</span>
                ) : null}
              </div>
            </section>
          </div>

          <WidgetPreview
            logoUrl={branding.logoUrl}
            companyName={branding.companyName}
            primaryColor={branding.primaryColor}
            hideVerloxAttribution={branding.hideVerloxAttribution}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            disabled={saving || !HEX_FULL.test(branding.primaryColor)}
            onClick={() =>
              void savePatch({
                companyName: branding.companyName,
                primaryColor: branding.primaryColor,
                hideVerloxAttribution: branding.hideVerloxAttribution,
                customDomain: branding.customDomain,
              })
            }
            className="rounded-md bg-accent px-6 py-2.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={resetDefaults}
            className="rounded-md border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-overlay"
          >
            Reset defaults
          </button>
          {saved ? <p className="text-xs text-green-400">Settings saved.</p> : null}
        </div>
      </PlanGateSection>
    </div>
  );
}
