'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArtifactCanvas } from '@/components/chat/ArtifactCanvas';
import { MarkdownContent } from '@/components/chat/MarkdownContent';

function CanvasBody() {
  const params = useSearchParams();
  const raw = params.get('content') ?? params.get('artifact') ?? '';
  const content = raw.trim();

  if (!content) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6 text-sm text-text-muted">
        <h1 className="text-lg font-medium text-text">Canvas</h1>
        <p>Open an artifact with a deep link such as <code>/canvas?content=...</code> or <code>/app/canvas?content=...</code>.</p>
        <p>Pass JSON artifact spec text or markdown with a fenced <code>artifact</code> block.</p>
      </div>
    );
  }

  const looksJson = content.startsWith('{') || content.startsWith('[');
  if (looksJson) {
    return (
      <div className="h-[calc(100vh-4rem)] p-4">
        <ArtifactCanvas content={content} />
      </div>
    );
  }

  const markdown = content.includes('```')
    ? content
    : `\`\`\`artifact\n${content}\n\`\`\``;

  return (
    <div className="mx-auto max-w-4xl p-4">
      <MarkdownContent content={markdown} />
    </div>
  );
}

export function CanvasStandalonePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-muted">Loading canvas...</div>}>
      <CanvasBody />
    </Suspense>
  );
}
