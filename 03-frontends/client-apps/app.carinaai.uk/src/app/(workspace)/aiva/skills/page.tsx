import { WorkspaceSkillsClient } from '@/components/workspace/WorkspaceSkillsClient';
import { requireSession } from '@/lib/session';

export default async function AivaSkillsPage() {
  await requireSession();
  return <WorkspaceSkillsClient />;
}
