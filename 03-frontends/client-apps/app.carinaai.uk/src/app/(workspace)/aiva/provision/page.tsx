import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AivaProvisionWizardClient } from '@/app/(workspace)/aiva/provision/AivaProvisionWizardClient';
import { requireSession } from '@/lib/session';

type PageProps = {
  searchParams: Promise<{ intent?: string; description?: string }>;
};

export default async function AivaProvisionPage({ searchParams }: PageProps) {
  await requireSession();
  const params = await searchParams;
  const hasExplicitIntent =
    params.intent?.trim().toLowerCase() === 'provision'
    || Boolean(params.description?.trim());

  if (!hasExplicitIntent) {
    redirect('/aiva');
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[90rem] px-6 py-8">
        <Suspense fallback={<p className="text-sm text-text-muted">Loading wizard...</p>}>
          <AivaProvisionWizardClient />
        </Suspense>
      </div>
    </div>
  );
}
