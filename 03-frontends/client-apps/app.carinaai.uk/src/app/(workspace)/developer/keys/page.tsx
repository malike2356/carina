import { requireSession, requireWorkspace } from '@/lib/session';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import { PageHeader } from '@/components/shell/PageHeader';
import { CreateKeyDialog } from '@/components/developer/CreateKeyDialog';
import { RevokeKeyButton } from '@/components/developer/RevokeKeyButton';
import { ClientApprovalPanel } from '@/components/developer/ClientApprovalPanel';

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitRpm: number;
  monthlyCapEvents: number;
  status: 'active' | 'revoked';
  lastUsedAt: string | null;
  createdAt: string;
}

async function fetchKeys(coreOrgId: string): Promise<ApiKey[]> {
  if (!coreProxyEnabled()) return [];
  const token = resolveCoreProxyToken();
  const url = `${resolveCoreUrl().replace(/\/$/, '')}/api/carina-ops/partner/api-keys`;
  try {
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-internal-key': token ?? '',
        'x-core-org-id': coreOrgId,
      },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.keys) ? (data.keys as ApiKey[]) : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function DeveloperKeysPage() {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);

  const isPartner = Boolean(workspace.coreOrgId);
  const keys = isPartner ? await fetchKeys(workspace.coreOrgId!) : [];
  const activeKeys = keys.filter((k) => k.status === 'active');

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader
        title="API keys"
        description="Create partner gateway keys to authenticate your integration."
        actions={isPartner ? <CreateKeyDialog /> : undefined}
      />
      <div className="px-6 py-6">
        {!isPartner ? (
          <div className="rounded-lg border border-border p-6 text-center">
            <p className="text-sm text-text-muted">
              This workspace is not linked to a partner account. Contact support to get started.
            </p>
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center">
            <p className="text-sm text-text-muted">No active API keys. Create one to start sending events.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-elevated/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Prefix</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Scopes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Rate limit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Last used</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeKeys.map((key) => (
                  <tr key={key.id} className="bg-surface hover:bg-elevated/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{key.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{key.keyPrefix}...</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <span key={s} className="rounded-full bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{key.rateLimitRpm}/min</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{formatDate(key.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RevokeKeyButton keyId={key.id} label={key.label} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isPartner ? <div className="px-6 pb-10"><ClientApprovalPanel /></div> : null}
    </div>
  );
}
