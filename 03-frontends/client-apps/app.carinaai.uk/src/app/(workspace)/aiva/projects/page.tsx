import { AivaProjectsBoard } from '@/components/aiva/AivaProjectsBoard';
import { requireSession } from '@/lib/session';

export default async function AivaProjectsPage() {
  await requireSession();

  return (
    <div className="flex-1 overflow-y-auto">
      <AivaProjectsBoard />
    </div>
  );
}
