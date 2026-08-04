import { WorkspaceDashboardClient } from '@/components/workspace/WorkspaceDashboardClient';
import { requireSession } from '@/lib/session';

export default async function AivaDashboardPage() {
  await requireSession();
  return <WorkspaceDashboardClient />;
}
