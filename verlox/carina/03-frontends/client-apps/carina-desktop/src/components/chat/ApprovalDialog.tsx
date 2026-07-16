import { useStore } from '@nanostores/react';
import { $pendingApproval } from '../../store/chat.js';
import { respondToApproval } from '../../lib/gateway-client.js';

interface Props {
  sessionId: string;
}

export default function ApprovalDialog({ sessionId }: Props) {
  const approval = useStore($pendingApproval);

  if (!approval) return null;

  async function respond(approved: boolean) {
    if (!approval) return;
    try {
      await respondToApproval(sessionId, approval.runId, approved);
    } finally {
      $pendingApproval.set(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-lg w-full shadow-2xl">
        <p className="text-sm font-semibold text-zinc-100 mb-1">Tool approval required</p>
        <p className="text-xs text-zinc-400 mb-3">{approval.reason}</p>
        <div className="bg-zinc-800 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Tool</p>
          <p className="text-sm font-mono text-zinc-200">{approval.toolName}</p>
          <p className="text-xs text-zinc-500 mt-2 mb-1 uppercase tracking-wide">Params</p>
          <pre className="text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(approval.params, null, 2)}
          </pre>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => void respond(false)}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => void respond(true)}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
