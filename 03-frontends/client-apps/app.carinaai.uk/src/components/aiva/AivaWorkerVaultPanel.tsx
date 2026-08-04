'use client';

import Link from 'next/link';

export function AivaWorkerVaultPanel({ workerId }: { workerId: string }) {
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-sm text-text-secondary">
        Credentials are encrypted and scoped to this worker ({workerId.slice(0, 8)}).
      </p>
      <Link
        href="/settings/keys"
        className="mt-2 inline-flex min-h-10 items-center text-xs font-medium text-accent hover:underline"
      >
        Manage vault keys
      </Link>
    </div>
  );
}

export default AivaWorkerVaultPanel;
