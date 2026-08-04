import { AivaLabPlayground } from '@/components/aiva/AivaLabPlayground';
import { requireSession } from '@/lib/session';

export default async function AivaLabPlaygroundPage() {
  await requireSession();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AivaLabPlayground />
    </div>
  );
}
