'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';

export function AivaOrgSettingsCard() {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Organization scope</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            The active organization scopes workers, projects, tool accounts, and canvas data.
            Workspace billing remains with the workspace owner.
          </p>
          <Link
            href="/aiva/org"
            className="mt-3 inline-flex min-h-11 items-center text-xs font-medium text-accent hover:underline"
          >
            Manage organization
          </Link>
        </div>
      </div>
    </section>
  );
}
