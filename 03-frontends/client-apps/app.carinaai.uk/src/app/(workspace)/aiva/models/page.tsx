import { WorkspaceModelsClient } from '@/components/workspace/WorkspaceModelsClient';
import { requireSession } from '@/lib/session';

export default async function AivaModelsPage() {
  await requireSession();
  return <WorkspaceModelsClient />;
}
