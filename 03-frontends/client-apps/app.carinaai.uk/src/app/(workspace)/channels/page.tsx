'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { IntegrationCatalog } from '@/components/integrations/IntegrationCatalog';
import { PageHeader } from '@/components/shell/PageHeader';

export default function ChannelsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Channels"
        description="Connect messaging channels, productivity tools, and devices. Add your own credentials per integration."
        actions={
          <Link
            href="/settings/channels"
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <IntegrationCatalog />
      </div>
    </div>
  );
}
