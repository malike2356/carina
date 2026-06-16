import { listWorkspaceKeys } from '@/lib/keys';
import { requireSession, requireWorkspace } from '@/lib/session';
import { AddKeyDialog } from '@/components/vault/AddKeyDialog';
import { DeleteKeyButton } from '@/components/vault/DeleteKeyButton';

export default async function KeysPage() {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const keys = await listWorkspaceKeys(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">BYOK key vault</h1>
          <p className="text-sm text-text-secondary">Keys are encrypted at rest and never shown in full.</p>
        </div>
        <AddKeyDialog />
      </div>
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
  );
}
