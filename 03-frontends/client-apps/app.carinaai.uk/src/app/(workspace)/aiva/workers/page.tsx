import { AivaWorkersClient } from '@/app/(workspace)/aiva/workers/AivaWorkersClient';
import { requireSession } from '@/lib/session';

export default async function AivaWorkersPage() {
  await requireSession();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <AivaWorkersClient />
      </div>
    </div>
  );
}
