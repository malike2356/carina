'use client';

import { WorkflowRunnerPage } from '@/components/agent-os/WorkflowRunnerPage';

export default function ContentSeriesPage() {
  return (
    <WorkflowRunnerPage
      title="Content Series"
      description="Hooks, scripts, and captions. Create publish tasks before posting."
      endpoint="/api/agent-os/workflows/content-series"
      fields={[
        { key: 'topic', label: 'Topic', placeholder: 'Agent OS glass' },
        { key: 'audience', label: 'Audience', placeholder: 'operators' },
        { key: 'platforms', label: 'Platforms', placeholder: 'LinkedIn, X, email' },
      ]}
    />
  );
}
