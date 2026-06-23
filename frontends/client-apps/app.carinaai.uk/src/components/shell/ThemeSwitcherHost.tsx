'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeSwitcherFloating } from '@/components/shell/ThemeSwitcher';
import type { ThemePreference } from '@/lib/theme-runtime';

function isChatRoute(pathname: string): boolean {
  return pathname === '/chat' || pathname.startsWith('/chat/');
}

export function ThemeSwitcherHost({
  initialPreference,
}: {
  initialPreference?: ThemePreference;
}) {
  const pathname = usePathname() ?? '/';
  const onChat = isChatRoute(pathname);
  const [voiceActive, setVoiceActive] = useState(
    () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-voice-input-active'),
  );

  useEffect(() => {
    function onVoiceInput(event: Event) {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setVoiceActive(Boolean(detail?.active));
    }
    document.addEventListener('carina:voice-input', onVoiceInput);
    return () => document.removeEventListener('carina:voice-input', onVoiceInput);
  }, []);

  if (onChat && voiceActive) {
    return null;
  }

  return (
    <ThemeSwitcherFloating
      position="bottom-right"
      inset={onChat ? 'above-composer' : 'default'}
      syncApi
      initialPreference={initialPreference}
    />
  );
}
