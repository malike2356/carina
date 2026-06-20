import { useEffect, useRef, useState } from 'react';
import {
  MotionActivity,
  type ActivityEvent,
  type ActivityType,
} from '@/lib/motion-activity';

interface UseActivityMonitorResult {
  currentActivity: ActivityType | null;
  lastEvent: ActivityEvent | null;
}

export function useActivityMonitor(enabled = true): UseActivityMonitorResult {
  const [currentActivity, setCurrentActivity] = useState<ActivityType | null>(null);
  const [lastEvent, setLastEvent] = useState<ActivityEvent | null>(null);
  const subRef = useRef<ReturnType<typeof MotionActivity.onActivityChanged>>(null);

  useEffect(() => {
    if (!enabled) return;

    void MotionActivity.startRecognition().catch(console.warn);
    subRef.current = MotionActivity.onActivityChanged((event) => {
      setLastEvent(event);
      if (event.transition === 'ENTER') {
        setCurrentActivity(event.activity);
      }
    });

    return () => {
      subRef.current?.remove();
      subRef.current = null;
      void MotionActivity.stopRecognition().catch(console.warn);
    };
  }, [enabled]);

  return { currentActivity, lastEvent };
}
