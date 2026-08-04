import { AivaHomeLanding } from '@/components/aiva/AivaHomeLanding';
import { CONTENT_PAGE } from '@/lib/page-shell';
import { requireSession } from '@/lib/session';

export default async function AivaHomePage() {
  await requireSession();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className={CONTENT_PAGE}>
        <AivaHomeLanding />
      </div>
    </div>
  );
}
