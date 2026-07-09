import { WorkspaceHome } from '@/components/workspace/WorkspaceHome';
import { requireSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function WorkspaceHomePage() {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const userName = session.user.name ?? session.user.email ?? '';

  return <WorkspaceHome workspaceId={workspace.id} userName={userName} />;
}
