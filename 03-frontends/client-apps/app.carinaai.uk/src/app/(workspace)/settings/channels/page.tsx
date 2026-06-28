'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { IntegrationCatalog } from '@/components/integrations/IntegrationCatalog';

export default function ChannelsSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/settings?section=join"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to settings
      </Link>
      <h1 className="text-lg font-semibold text-text-primary">Channels and integrations</h1>
      <p className="mt-1 text-xs text-text-muted">
        Connect the services your workspace uses. Messaging channels attach per Aiva worker; productivity
        tools are workspace-wide.
      </p>
      <div className="mt-6">
        <IntegrationCatalog />
      </div>
      <div className="mt-8">
        <Link
          href="/channels"
          className="rounded-md border border-border px-3 py-2 text-xs text-text-secondary hover:bg-elevated"
        >
          Open channels hub
        </Link>
      </div>
    </div>
  );
}
