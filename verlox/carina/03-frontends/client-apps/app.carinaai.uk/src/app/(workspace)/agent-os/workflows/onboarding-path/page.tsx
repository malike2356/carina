'use client';

import { WorkflowRunnerPage } from '@/components/agent-os/WorkflowRunnerPage';

export default function OnboardingPathPage() {
  return (
    <WorkflowRunnerPage
      title="Onboarding Path"
      description="Welcome sequence plus Day 1 / 7 / 30 checklists stored as a document."
      endpoint="/api/agent-os/workflows/onboarding-path"
      fields={[
        { key: 'product', label: 'Product', placeholder: 'Carina' },
        { key: 'audience', label: 'Audience', placeholder: 'new users' },
      ]}
    />
  );
}
