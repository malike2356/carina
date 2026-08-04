import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { EscalationsPane } from '@/components/inbox/InboxPanes';
import { ScreenShell } from '@/components/ScreenShell';

export default function InboxEscalationsScreen() {
  return (
    <ScreenShell
      title="Escalations"
      subtitle="Open handoffs waiting for a human."
      showBack
      scroll={false}
    >
      <CloudFeatureGate feature="aiva">
        <EscalationsPane />
      </CloudFeatureGate>
    </ScreenShell>
  );
}
