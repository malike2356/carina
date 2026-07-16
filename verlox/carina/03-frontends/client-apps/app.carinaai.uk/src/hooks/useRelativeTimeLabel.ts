'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/relative-time';
import { useHydrated } from '@/hooks/useHydrated';

const PLACEHOLDER = '...';

export function useRelativeTimeLabel(
  date: Date | string | null,
  refreshMs = 15000,
): string {
  const hydrated = useHydrated();
  const [label, setLabel] = useState(PLACEHOLDER);

  useEffect(() => {
    const compute = () => formatRelativeTime(date);
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), refreshMs);
    return () => clearInterval(id);
  }, [date, refreshMs]);

  return hydrated ? label : PLACEHOLDER;
}

export function useGreeting(): string {
  const hydrated = useHydrated();
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return hydrated ? greeting : 'Hello';
}

export function useClockTime(refreshMs = 10000): string {
  const hydrated = useHydrated();
  const [time, setTime] = useState(PLACEHOLDER);

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return hydrated ? time : PLACEHOLDER;
}
