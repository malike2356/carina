import { Suspense } from 'react';
import { AivaApprovalsClient, InboxLoadingFallback } from './AivaApprovalsClient';

export default function AivaApprovalsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <Suspense fallback={<InboxLoadingFallback />}>
        <AivaApprovalsClient />
      </Suspense>
    </div>
  );
}
