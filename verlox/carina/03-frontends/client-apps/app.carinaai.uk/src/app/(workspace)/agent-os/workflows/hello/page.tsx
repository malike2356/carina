'use client';

import { WorkflowRunnerPage } from '@/components/agent-os/WorkflowRunnerPage';

export default function HelloWorkflowPage() {
  return (
    <WorkflowRunnerPage
      title="Hello recipe"
      description="One guided run that writes a real document in under five minutes."
      endpoint="/api/agent-os/workflows/hello"
      fields={[
        { key: 'business', label: 'Business name', placeholder: 'Acme Ops' },
        { key: 'brief', label: 'What should we produce?', placeholder: 'One-page brief for our launch' },
      ]}
      onSuccessExtra={() => {
        try {
          localStorage.setItem('carina-agent-os-hello-done', '1');
        } catch {
          /* ignore */
        }
      }}
    />
  );
}
