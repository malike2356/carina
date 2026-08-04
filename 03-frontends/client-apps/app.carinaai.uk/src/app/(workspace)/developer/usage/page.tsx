import { redirect } from 'next/navigation';
import { requireSession, requireWorkspace } from '@/lib/session';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import { isAivaProductHost } from '@/lib/product-surface';
import { getRequestHostname } from '@/lib/server-brand';
import { PageHeader } from '@/components/shell/PageHeader';
import { UsageDashboard } from '@/components/developer/UsageDashboard';

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchInitialUsage(coreOrgId: string) {
  if (!coreProxyEnabled()) return null;
  const token = resolveCoreProxyToken();
  const from = monthStartIso();
  const to = todayIso();
  const url = `${resolveCoreUrl().replace(/\/$/, '')}/api/carina-ops/partner/usage?from=${from}&to=${to}&groupBy=day`;
  try {
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-internal-key': token,
        'x-core-org-id': coreOrgId,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DeveloperUsagePage() {
  const hostname = await getRequestHostname();
  // Aiva "Usage" is worker analytics, not partner gateway metering.
  if (isAivaProductHost(hostname)) {
    redirect('/analytics');
  }

  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);

  const isPartner = Boolean(workspace.coreOrgId);
  const initialData = isPartner ? await fetchInitialUsage(workspace.coreOrgId!) : null;

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader
        title="Usage"
        description="Gateway event volume and estimated fees."
      />
      <div className="px-6 py-6">
        {!isPartner ? (
          <div className="rounded-lg border border-border p-6 text-center">
            <p className="text-sm text-text-muted">
              This workspace is not linked to a partner account. Contact support to get started.
            </p>
          </div>
        ) : (
          <UsageDashboard initialData={initialData} />
        )}
      </div>
    </div>
  );
}
