'use client';

import { WorkflowRunnerPage } from '@/components/agent-os/WorkflowRunnerPage';

export default function VideoWorkflowPage() {
  return (
    <WorkflowRunnerPage
      title="Video Agent"
      description="Prep script and storyboard. Never auto-publishes to YouTube."
      endpoint="/api/agent-os/workflows/video"
      fields={[
        { key: 'topic', label: 'Topic', placeholder: 'Agent OS walkthrough' },
        { key: 'audience', label: 'Audience', placeholder: 'operators' },
        { key: 'minutes', label: 'Length (minutes)', placeholder: '8' },
      ]}
    />
  );
}
