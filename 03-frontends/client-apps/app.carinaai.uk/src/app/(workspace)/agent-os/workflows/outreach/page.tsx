'use client';

import { WorkflowRunnerPage } from '@/components/agent-os/WorkflowRunnerPage';

export default function OutreachWorkflowPage() {
  return (
    <WorkflowRunnerPage
      title="Outreach / Lead"
      description="Creates a plan document and a draft follow-up task. No mass-send."
      endpoint="/api/agent-os/workflows/outreach"
      fields={[
        { key: 'audience', label: 'Audience', placeholder: 'agency owners' },
        { key: 'offer', label: 'Offer', placeholder: 'a free install review' },
        { key: 'channel', label: 'Channel preference', placeholder: 'email' },
      ]}
    />
  );
}
