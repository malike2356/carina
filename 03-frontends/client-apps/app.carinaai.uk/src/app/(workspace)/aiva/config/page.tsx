import { WorkspaceConfigClient } from '@/components/workspace/WorkspaceConfigClient';
import { requireSession } from '@/lib/session';

export default async function AivaConfigPage() {
  await requireSession();
  return <WorkspaceConfigClient />;
}
