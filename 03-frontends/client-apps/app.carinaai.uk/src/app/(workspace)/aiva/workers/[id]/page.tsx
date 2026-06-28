import { AivaDetailClient } from '@/app/(workspace)/aiva/workers/[id]/AivaDetailClient';
import { AIVA_CORE_TABS, type AivaTab } from '@/app/(workspace)/aiva/workers/[id]/aiva-detail-tabs';
import { requireSession } from '@/lib/session';

export default async function AivaWorkerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { tab } = await searchParams;
  const validTabIds = new Set(AIVA_CORE_TABS.map((item) => item.id));
  const initialTab = tab && validTabIds.has(tab as AivaTab['id'])
    ? (tab as AivaTab['id'])
    : undefined;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <AivaDetailClient workerId={id} initialTab={initialTab} />
      </div>
    </div>
  );
}
