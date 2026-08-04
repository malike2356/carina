'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { aivaAppOrigin, aivaProductHost, cloudAppHost } from '@/lib/product-surface';
import { cn } from '@/lib/utils';

type ProviderType = 'oidc' | 'saml';

interface SsoProviderRow {
  id: string;
  providerType: ProviderType;
  displayName: string;
  domain: string;
  issuer: string | null;
  samlEntityId: string | null;
  samlSsoUrl: string | null;
  defaultRole: string;
  ssoRequired: boolean;
  enabled: boolean;
  createdAt: string;
}

interface ProviderFormState {
  providerType: ProviderType;
  displayName: string;
  domain: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  defaultRole: 'member' | 'admin';
  enabled: boolean;
  ssoRequired: boolean;
}

const EMPTY_FORM: ProviderFormState = {
  providerType: 'oidc',
  displayName: '',
  domain: '',
  issuer: '',
  clientId: '',
  clientSecret: '',
  entityId: '',
  ssoUrl: '',
  certificate: '',
  defaultRole: 'member',
  enabled: true,
  ssoRequired: false,
};

function callbackUrls() {
  const appHost = typeof window !== 'undefined'
    ? window.location.origin
    : `https://${cloudAppHost()}`;
  const aivaHost = aivaAppOrigin();
  return {
    oidcCallback: `${appHost}/api/auth/sso/callback`,
    samlAcs: `${appHost}/api/auth/sso/saml/acs`,
    aivaNote: aivaHost,
  };
}

export function SsoSettings({ isOwner }: { isOwner: boolean }) {
  const [providers, setProviders] = useState<SsoProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const urls = callbackUrls();

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/workspace/sso/providers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load SSO providers');
      setProviders(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SSO providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) void loadProviders();
  }, [isOwner, loadProviders]);

  if (!isOwner) {
    return (
      <p className="text-xs text-text-muted">
        Only workspace owners can configure single sign-on providers.
      </p>
    );
  }

  function openCreate(type: ProviderType) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, providerType: type });
    setFormOpen(true);
    setError('');
  }

  function openEdit(row: SsoProviderRow) {
    setEditingId(row.id);
    setForm({
      providerType: row.providerType,
      displayName: row.displayName,
      domain: row.domain,
      issuer: row.issuer ?? '',
      clientId: '',
      clientSecret: '',
      entityId: row.samlEntityId ?? '',
      ssoUrl: row.samlSsoUrl ?? '',
      certificate: '',
      defaultRole: row.defaultRole === 'admin' ? 'admin' : 'member',
      enabled: row.enabled,
      ssoRequired: row.ssoRequired,
    });
    setFormOpen(true);
    setError('');
  }

  async function saveProvider() {
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const patch: Record<string, unknown> = {
          displayName: form.displayName,
          enabled: form.enabled,
          defaultRole: form.defaultRole,
          ssoRequired: form.ssoRequired,
        };
        if (form.providerType === 'oidc') {
          if (form.clientId) patch.clientId = form.clientId;
          if (form.clientSecret) patch.clientSecret = form.clientSecret;
          if (form.issuer) patch.issuer = form.issuer;
        } else {
          if (form.entityId) patch.samlEntityId = form.entityId;
          if (form.ssoUrl) patch.samlSsoUrl = form.ssoUrl;
          if (form.certificate) patch.samlCertificate = form.certificate;
        }
        const res = await fetch(`/api/workspace/sso/providers/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Update failed');
      } else {
        const body = form.providerType === 'oidc'
          ? {
              providerType: 'oidc',
              displayName: form.displayName,
              domain: form.domain,
              issuer: form.issuer,
              clientId: form.clientId,
              clientSecret: form.clientSecret,
              defaultRole: form.defaultRole,
              enabled: form.enabled,
            }
          : {
              providerType: 'saml',
              displayName: form.displayName,
              domain: form.domain,
              entityId: form.entityId,
              ssoUrl: form.ssoUrl,
              certificate: form.certificate,
              defaultRole: form.defaultRole,
              enabled: form.enabled,
            };
        const res = await fetch('/api/workspace/sso/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Create failed');
      }
      setFormOpen(false);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider(id: string, name: string) {
    if (!window.confirm(`Delete SSO provider "${name}"?`)) return;
    const res = await fetch(`/api/workspace/sso/providers/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Delete failed');
      return;
    }
    await loadProviders();
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Single sign-on</h2>
        <p className="mt-1 text-xs text-text-muted">
          Configure OIDC or SAML providers for your company email domain. Members sign in through your IdP.
        </p>
      </div>

      <div className="rounded-md border border-border bg-base p-3 text-xs text-text-secondary">
        <p className="font-medium text-text-primary">Callback URLs for your IdP</p>
        <p className="mt-2">
          OIDC redirect URI:
          <code className="ml-1 break-all text-accent">{urls.oidcCallback}</code>
        </p>
        <p className="mt-1">
          SAML ACS URL:
          <code className="ml-1 break-all text-accent">{urls.samlAcs}</code>
        </p>
        <p className="mt-2 text-text-muted">
          Aiva host ({urls.aivaNote}) uses the same callback paths on the app origin.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="text-xs text-text-muted">Loading providers...</p>
      ) : providers.length === 0 ? (
        <p className="text-xs text-text-muted">No SSO providers configured yet.</p>
      ) : (
        <div className="space-y-2">
          {providers.map((row) => (
            <div key={row.id} className="rounded-md border border-border bg-base p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">{row.displayName}</p>
                  <p className="text-xs text-text-muted">
                    {row.providerType.toUpperCase()} · {row.domain} · {row.enabled ? 'Enabled' : 'Disabled'}
                    {row.ssoRequired ? ' · SSO required' : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-text-muted">
                    Default role: {row.defaultRole} · Added {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => deleteProvider(row.id, row.displayName)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!formOpen ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => openCreate('oidc')}>
            Add OIDC provider
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openCreate('saml')}>
            Add SAML provider
          </Button>
        </div>
      ) : (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {editingId ? 'Edit provider' : `New ${form.providerType.toUpperCase()} provider`}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="sso-display-name">Display name</Label>
              <Input
                id="sso-display-name"
                value={form.displayName}
                onChange={(e) => setForm((c) => ({ ...c, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sso-domain">Company email domain</Label>
              <Input
                id="sso-domain"
                value={form.domain}
                onChange={(e) => setForm((c) => ({ ...c, domain: e.target.value }))}
                placeholder="example.com"
                disabled={Boolean(editingId)}
              />
            </div>
          </div>

          {form.providerType === 'oidc' ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="sso-issuer">Issuer URL</Label>
                <Input
                  id="sso-issuer"
                  value={form.issuer}
                  onChange={(e) => setForm((c) => ({ ...c, issuer: e.target.value }))}
                  placeholder="https://login.example.com"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="sso-client-id">Client ID</Label>
                  <Input
                    id="sso-client-id"
                    value={form.clientId}
                    onChange={(e) => setForm((c) => ({ ...c, clientId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sso-client-secret">
                    Client secret{editingId ? ' (leave blank to keep)' : ''}
                  </Label>
                  <Input
                    id="sso-client-secret"
                    type="password"
                    value={form.clientSecret}
                    onChange={(e) => setForm((c) => ({ ...c, clientSecret: e.target.value }))}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="sso-entity-id">Entity ID</Label>
                <Input
                  id="sso-entity-id"
                  value={form.entityId}
                  onChange={(e) => setForm((c) => ({ ...c, entityId: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sso-sso-url">SSO URL</Label>
                <Input
                  id="sso-sso-url"
                  value={form.ssoUrl}
                  onChange={(e) => setForm((c) => ({ ...c, ssoUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sso-cert">
                  X.509 certificate{editingId ? ' (leave blank to keep)' : ''}
                </Label>
                <textarea
                  id="sso-cert"
                  value={form.certificate}
                  onChange={(e) => setForm((c) => ({ ...c, certificate: e.target.value }))}
                  rows={4}
                  className={cn(
                    'w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary',
                  )}
                />
              </div>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Default member role</Label>
              <div className="flex gap-2">
                {(['member', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, defaultRole: role }))}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs capitalize',
                      form.defaultRole === role
                        ? 'border-accent/40 bg-accent-dim text-accent'
                        : 'border-border text-text-secondary',
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="divide-y divide-border rounded-md border border-border px-3">
            <label className="flex items-center justify-between py-2 text-sm">
              <span>Enable provider</span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((c) => ({ ...c, enabled: e.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between py-2 text-sm">
              <span>Require SSO for this domain</span>
              <input
                type="checkbox"
                checked={form.ssoRequired}
                onChange={(e) => setForm((c) => ({ ...c, ssoRequired: e.target.checked }))}
              />
            </label>
          </div>
          <p className="text-[11px] text-text-muted">
            When SSO is required, members must use SSO. Workspace owners can still use password sign-in as a fallback.
          </p>

          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => void saveProvider()}>
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create provider'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
