'use client';

import { WorkflowRunnerPage } from '@/components/agent-os/WorkflowRunnerPage';

export default function SeoWorkflowPage() {
  return (
    <WorkflowRunnerPage
      title="SEO Agent"
      description="Outline and draft. GSC fetch only when that API exists; otherwise prep-only."
      endpoint="/api/agent-os/workflows/seo"
      fields={[
        { key: 'keyword', label: 'Primary keyword', placeholder: 'agent workspace' },
        { key: 'url', label: 'URL or site notes', placeholder: 'https://example.com' },
        { key: 'notes', label: 'Extra notes', multiline: true },
      ]}
    />
  );
}
