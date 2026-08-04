import { listWorkspaceKeys } from '@/lib/keys';
import { requireSession, requireWorkspace } from '@/lib/session';
import { AddKeyDialog } from '@/components/vault/AddKeyDialog';
import { DeleteKeyButton } from '@/components/vault/DeleteKeyButton';
import { PageHeader } from '@/components/shell/PageHeader';

export default async function KeysPage() {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const keys = await listWorkspaceKeys(workspace.id);

  return (
    <div className="mx-auto max-w-[90rem]">
      <PageHeader
        title="API keys"
        description="Manage your bring-your-own-key API credentials."
        backHref="/settings"
        backLabel="Settings"
        actions={<AddKeyDialog />}
      />
      <div className="space-y-6 px-6 py-8">
      <div className="space-y-3">
        {keys.length === 0 ? (
          <p className="text-sm text-text-muted">No provider keys yet. Add one to start chatting.</p>
        ) : (
          keys.map((key) => (
            <DeleteKeyButton
              key={key.id}
              keyId={key.id}
              provider={key.provider}
              keyHint={key.keyHint}
            />
          ))
        )}
      </div>
      </div>
    </div>
  );
}
