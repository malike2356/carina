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

  return <AivaDetailClient workerId={id} initialTab={initialTab} />;
}
