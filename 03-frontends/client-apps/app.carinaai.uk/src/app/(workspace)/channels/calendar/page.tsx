import { CalendarConnectionPanel } from '@/components/integrations/CalendarConnectionPanel';

export default function CalendarChannelPage() {
  return (
    <CalendarConnectionPanel
      backHref="/channels"
      backLabel="All channels"
      title="Calendar sync"
    />
  );
}
