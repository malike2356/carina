import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db';
import { users, workspaces } from '@/db/schema';
import { requireSession } from '@/lib/session';
import { ScoutUnlockPanel } from '@/components/security/ScoutUnlockPanel';

export const dynamic = 'force-dynamic';

export default async function OpsScoutPage() {
  await requireSession();

  const rows = await db
    .select({
      workspaceId: workspaces.id,
      name: workspaces.name,
      plan: workspaces.plan,
      scoutPairingAllowed: workspaces.scoutPairingAllowed,
      email: users.email,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.userId))
    .orderBy(desc(workspaces.updatedAt))
    .limit(40);

  const unlocked = rows.filter((row) => row.scoutPairingAllowed);

  return (
    <div className="w-full min-w-0 max-w-none space-y-8 p-4">
      <div>
        <p className="text-xs text-text-muted">
          <Link href="/security" className="text-accent underline">
            Back to Security
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Ops: Scout access</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Allow Scout pairing for any Cloud tenant without changing their billing plan. Uses the
          ops token in the form below (GUI only; no env edits).
        </p>
      </div>

      <ScoutUnlockPanel currentlyAllowed={false} mode="ops" />

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">Currently unlocked</h2>
        {unlocked.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">No workspaces have a Scout unlock flag.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {unlocked.map((row) => (
              <li
                key={row.workspaceId}
                className="rounded-md border border-border px-3 py-2 text-text-secondary"
              >
                <span className="font-medium text-text-primary">{row.email}</span>
                <span className="ml-2 text-xs text-text-muted">
                  {row.plan} · {row.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">Recent workspaces</h2>
        <ul className="mt-3 space-y-2 text-xs text-text-muted">
          {rows.map((row) => (
            <li key={row.workspaceId} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {row.email} · {row.plan}
                {row.scoutPairingAllowed ? ' · unlocked' : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
