'use client';

import { Suspense } from 'react';
import { DocumentVaultExplorer } from '@/components/documents/DocumentVaultExplorer';
import { Spinner } from '@/components/ui/Spinner';

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <DocumentVaultExplorer />
    </Suspense>
  );
}
