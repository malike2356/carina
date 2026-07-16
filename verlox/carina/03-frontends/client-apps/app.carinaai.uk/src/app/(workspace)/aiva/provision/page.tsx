import { Suspense } from 'react';
import { AivaProvisionWizardClient } from '@/app/(workspace)/aiva/provision/AivaProvisionWizardClient';
import { requireSession } from '@/lib/session';

export default async function AivaProvisionPage() {
  await requireSession();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Suspense fallback={<p className="text-sm text-text-muted">Loading wizard...</p>}>
          <AivaProvisionWizardClient />
        </Suspense>
      </div>
    </div>
  );
}
