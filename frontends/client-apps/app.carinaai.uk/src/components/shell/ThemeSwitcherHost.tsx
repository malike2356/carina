'use client';

import { ThemeSwitcherFloating } from '@/components/shell/ThemeSwitcher';

export function ThemeSwitcherHost() {
  return <ThemeSwitcherFloating syncApi={false} />;
}
