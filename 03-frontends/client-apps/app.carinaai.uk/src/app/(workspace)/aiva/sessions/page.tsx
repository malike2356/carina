import { WorkspaceSessionsClient } from '@/components/workspace/WorkspaceSessionsClient';
import { requireSession } from '@/lib/session';

export default async function AivaSessionsPage() {
  await requireSession();
  return <WorkspaceSessionsClient />;
}
