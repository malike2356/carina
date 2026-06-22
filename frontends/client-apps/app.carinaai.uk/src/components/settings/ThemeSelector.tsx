'use client';

import { useState } from 'react';
import { ThemeSwitcher } from '@/components/shell/ThemeSwitcher';
import type { ThemePreference } from '@/lib/theme-runtime';

interface ThemeSelectorProps {
  currentTheme: string;
  onChange: (theme: string) => void;
}

export function ThemeSelector({ currentTheme, onChange }: ThemeSelectorProps) {
  const [activeTheme, setActiveTheme] = useState(currentTheme);

  function handleThemeChange(preference: ThemePreference) {
    setActiveTheme(preference.themeId);
    onChange(preference.themeId);
  }

  return (
    <div className="space-y-3">
      <ThemeSwitcher variant="panel" syncApi={false} onChange={handleThemeChange} />
      <p className="text-xs text-text-muted">
        Active theme: <span className="font-mono text-text-secondary">{activeTheme}</span>
      </p>
    </div>
  );
}
