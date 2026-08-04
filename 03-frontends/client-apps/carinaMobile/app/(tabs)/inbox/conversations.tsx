import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ConversationsPane } from '@/components/inbox/InboxPanes';
import { ScreenShell } from '@/components/ScreenShell';

export default function InboxConversationsScreen() {
  return (
    <ScreenShell
      title="Conversations"
      subtitle="Recent threads across employees."
      showBack
      scroll={false}
    >
      <CloudFeatureGate feature="aiva">
        <ConversationsPane />
      </CloudFeatureGate>
    </ScreenShell>
  );
}
