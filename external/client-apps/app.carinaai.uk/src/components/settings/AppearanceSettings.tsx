'use client';

import { useState } from 'react';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { DEFAULT_THEME } from '@/lib/themes';

export function AppearanceSettings({ initialTheme }: { initialTheme: string }) {
  const [theme, setTheme] = useState(initialTheme || DEFAULT_THEME);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function saveTheme(nextTheme: string) {
    setTheme(nextTheme);
    setStatus('saving');
    const response = await fetch('/api/workspace/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: nextTheme }),
    });

    if (response.ok) {
      setStatus('saved');
      window.setTimeout(() => setStatus('idle'), 1500);
    } else {
      setStatus('error');
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Appearance</h2>
          <p className="mt-1 text-xs text-text-secondary">Choose the workspace theme applied across Carina.</p>
        </div>
        <p className="min-w-16 text-right text-[11px] text-text-muted">
          {status === 'saving' && 'Saving'}
          {status === 'saved' && 'Saved'}
          {status === 'error' && 'Failed'}
        </p>
      </div>
      <ThemeSelector currentTheme={theme} onChange={(nextTheme) => void saveTheme(nextTheme)} />
    </section>
  );
}
