'use client';

import { useState } from 'react';
import { Database } from 'lucide-react';
import { KnowledgeUploadPanel } from '@/components/knowledge/KnowledgeUploadPanel';
import { KnowledgeSourceList } from '@/components/knowledge/KnowledgeSourceList';
import { RagSearchPreview } from '@/components/knowledge/RagSearchPreview';

export default function KnowledgePage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function onIngested() {
    setRefreshTrigger((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-5 w-5 text-accent" />
        <div>
          <h1 className="text-lg font-semibold text-text">Knowledge Base</h1>
          <p className="text-xs text-text-muted">
            Upload documents to grow the RAG knowledge base Carina draws from during sessions.
          </p>
        </div>
      </div>

      <KnowledgeUploadPanel onIngested={onIngested} />
      <KnowledgeSourceList refreshTrigger={refreshTrigger} />
      <RagSearchPreview />
    </div>
  );
}
