import { eq } from 'drizzle-orm';
import { pairScout } from '@/lib/actions';
import { listAuditLog } from '@/lib/audit';
import { db } from '@/db';
import { byokKeys } from '@/db/schema';
import { requireSession, requireWorkspace } from '@/lib/session';
import { securityDashboardCoreConfigured } from '@/lib/security-dashboard-core';
import { SecurityDashboardClient } from '@/components/security/SecurityDashboardClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const scoutKeys = await db
    .select()
    .from(byokKeys)
    .where(eq(byokKeys.workspaceId, workspace.id));

  const scoutPaired = scoutKeys.some((key) => key.provider === 'labyrinth-scout');
  const auditRows = scoutPaired
    ? await listAuditLog(workspace.id, 'scout:', 10)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-sm text-text-secondary">
          Unified security operations dashboard and optional Scout pairing.
        </p>
      </div>

      <SecurityDashboardClient showStubWarning={!securityDashboardCoreConfigured()} />

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold">Scout pairing</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Optional Labyrinth Scout integration for Team plans.
        </p>

        {workspace.plan !== 'team' ? (
          <p className="text-sm text-text-secondary">
            Scout pairing is available on the Team plan. Upgrade on the Billing page.
          </p>
        ) : scoutPaired ? (
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-accent-dim px-3 py-1 text-sm font-medium text-accent">
              Scout connected
            </p>
            <p className="text-sm text-text-secondary">
              Open your Scout console to review alerts and audit events.
            </p>
            {auditRows.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Recent Scout audit events</h3>
                <ul className="space-y-2 text-sm text-text-secondary">
                  {auditRows.map((row) => (
                    <li key={row.id} className="rounded-md border border-border px-3 py-2">
                      <span className="font-medium">{row.action}</span>
                      <span className="ml-2 text-text-muted">{row.createdAt?.toISOString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <form action={pairScout} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="consoleUrl">Scout console URL</Label>
              <Input id="consoleUrl" name="consoleUrl" placeholder="https://console.labyrinthscout.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">Scout API key</Label>
              <Input id="apiKey" name="apiKey" type="password" autoComplete="off" required />
            </div>
            <Button type="submit">Pair Scout</Button>
          </form>
        )}
      </div>
    </div>
  );
}
