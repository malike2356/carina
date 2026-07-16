'use client';

import { KeprixIntegrationsHub } from '@/components/integrations/KeprixIntegrationsHub';
import { PageHeader } from '@/components/shell/PageHeader';

export default function IntegrationsPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Integrations"
        description="Browse Keprix connectors for visual playbooks. Worker channels stay in Aiva settings."
      />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <KeprixIntegrationsHub />
      </div>
    </div>
  );
}
