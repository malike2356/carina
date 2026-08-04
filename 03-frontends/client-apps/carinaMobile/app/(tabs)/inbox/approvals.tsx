import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ApprovalsPane } from '@/components/inbox/InboxPanes';
import { ScreenShell } from '@/components/ScreenShell';

export default function InboxApprovalsScreen() {
  return (
    <ScreenShell
      title="Approvals"
      subtitle="Drafts waiting for your approval."
      showBack
      scroll={false}
    >
      <CloudFeatureGate feature="aiva">
        <ApprovalsPane />
      </CloudFeatureGate>
    </ScreenShell>
  );
}
