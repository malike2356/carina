import { AivaWorkspaceLab } from '@/components/aiva/AivaWorkspaceLab';
import { requireSession } from '@/lib/session';

export default async function AivaWorkspaceLabPage() {
  await requireSession();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full min-w-0 max-w-none px-4 py-6 sm:px-6 lg:px-8">
        <AivaWorkspaceLab />
      </div>
    </div>
  );
}
