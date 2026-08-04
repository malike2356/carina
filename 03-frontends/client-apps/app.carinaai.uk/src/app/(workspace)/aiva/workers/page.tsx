import { AivaWorkersClient } from '@/app/(workspace)/aiva/workers/AivaWorkersClient';
import { CONTENT_PAGE } from '@/lib/page-shell';
import { requireSession } from '@/lib/session';

export default async function AivaWorkersPage() {
  await requireSession();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`${CONTENT_PAGE} space-y-8`}>
        <AivaWorkersClient />
      </div>
    </div>
  );
}
