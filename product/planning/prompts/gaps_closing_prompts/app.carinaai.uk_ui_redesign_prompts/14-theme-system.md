# Prompt 14 - Theme System

## Objective

Implement a theme system with 4 Carina presets (Dark, Light, Midnight, Forest), each defined as a complete set of CSS custom property overrides. The selected theme is persisted to the `workspaceSettings` table and applied on page load. No flash of wrong theme. Users switch themes from the Appearance section of Settings.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-13 complete. The `workspaceSettings` table exists (Prompt 01). The `:root` CSS variables are defined in `globals.css` (Prompt 00 design system).

---

## Step 1 - Define Theme Tokens

In `src/lib/themes.ts`, define the 4 theme presets as plain objects mapping CSS variable names to values:

```ts
export interface ThemeTokens {
  '--bg-base':           string;
  '--bg-surface':        string;
  '--bg-elevated':       string;
  '--bg-overlay':        string;
  '--border-subtle':     string;
  '--border-focus':      string;
  '--border-muted':      string;
  '--text-primary':      string;
  '--text-secondary':    string;
  '--text-muted':        string;
  '--accent':            string;
  '--accent-dim':        string;
  '--accent-hover':      string;
  '--danger':            string;
  '--danger-dim':        string;
  '--bubble-user':       string;
  '--bubble-assistant':  string;
  '--code-bg':           string;
  '--code-text':         string;
}

export const THEMES: Record<string, { label: string; description: string; tokens: ThemeTokens }> = {
  dark: {
    label:       'Dark',
    description: 'Deep charcoal backgrounds with Carina green accents. Default.',
    tokens: {
      '--bg-base':          '#0f1117',
      '--bg-surface':       '#161921',
      '--bg-elevated':      '#1e2130',
      '--bg-overlay':       '#252838',
      '--border-subtle':    '#2a2d3e',
      '--border-focus':     '#22c55e',
      '--border-muted':     '#1e2130',
      '--text-primary':     '#f0f2f5',
      '--text-secondary':   '#8b92a5',
      '--text-muted':       '#4a5068',
      '--accent':           '#22c55e',
      '--accent-dim':       '#166534',
      '--accent-hover':     '#16a34a',
      '--danger':           '#ef4444',
      '--danger-dim':       '#7f1d1d',
      '--bubble-user':      '#1e3a2f',
      '--bubble-assistant': '#1a1d2e',
      '--code-bg':          '#0d1117',
      '--code-text':        '#e6edf3',
    },
  },

  light: {
    label:       'Light',
    description: 'Clean white surface with green accents. Good for bright environments.',
    tokens: {
      '--bg-base':          '#f8f9fa',
      '--bg-surface':       '#ffffff',
      '--bg-elevated':      '#f1f3f5',
      '--bg-overlay':       '#e9ecef',
      '--border-subtle':    '#dee2e6',
      '--border-focus':     '#16a34a',
      '--border-muted':     '#f1f3f5',
      '--text-primary':     '#1a1d2e',
      '--text-secondary':   '#495057',
      '--text-muted':       '#adb5bd',
      '--accent':           '#16a34a',
      '--accent-dim':       '#dcfce7',
      '--accent-hover':     '#15803d',
      '--danger':           '#dc2626',
      '--danger-dim':       '#fee2e2',
      '--bubble-user':      '#dcfce7',
      '--bubble-assistant': '#f1f3f5',
      '--code-bg':          '#0d1117',
      '--code-text':        '#e6edf3',
    },
  },

  midnight: {
    label:       'Midnight',
    description: 'Pure black base with electric blue accents. Maximum contrast for late nights.',
    tokens: {
      '--bg-base':          '#000000',
      '--bg-surface':       '#0a0a0f',
      '--bg-elevated':      '#111118',
      '--bg-overlay':       '#181820',
      '--border-subtle':    '#1e1e2a',
      '--border-focus':     '#3b82f6',
      '--border-muted':     '#111118',
      '--text-primary':     '#ffffff',
      '--text-secondary':   '#94a3b8',
      '--text-muted':       '#475569',
      '--accent':           '#3b82f6',
      '--accent-dim':       '#1e3a5f',
      '--accent-hover':     '#2563eb',
      '--danger':           '#ef4444',
      '--danger-dim':       '#7f1d1d',
      '--bubble-user':      '#1e2a4f',
      '--bubble-assistant': '#0f1118',
      '--code-bg':          '#000000',
      '--code-text':        '#f1f5f9',
    },
  },

  forest: {
    label:       'Forest',
    description: 'Warm dark greens with amber accents. Calm and focused.',
    tokens: {
      '--bg-base':          '#0d1411',
      '--bg-surface':       '#121a16',
      '--bg-elevated':      '#182219',
      '--bg-overlay':       '#1e2a1f',
      '--border-subtle':    '#253326',
      '--border-focus':     '#f59e0b',
      '--border-muted':     '#182219',
      '--text-primary':     '#e8f5e9',
      '--text-secondary':   '#81c784',
      '--text-muted':       '#4caf50',
      '--accent':           '#f59e0b',
      '--accent-dim':       '#451a03',
      '--accent-hover':     '#d97706',
      '--danger':           '#ef4444',
      '--danger-dim':       '#7f1d1d',
      '--bubble-user':      '#1a2e1e',
      '--bubble-assistant': '#131a14',
      '--code-bg':          '#0a100c',
      '--code-text':        '#d4edda',
    },
  },
};

export const DEFAULT_THEME = 'dark';
```

---

## Step 2 - WorkspaceSettings API

Create `src/app/api/workspace/settings/route.ts` to GET and PATCH workspace settings:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const [settings] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspace.id))
    .limit(1);

  return NextResponse.json({ data: settings ?? { workspaceId: workspace.id, theme: 'dark' } });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { theme?: string; customTheme?: unknown; appearance?: unknown };
  const updates: Partial<typeof workspaceSettings.$inferInsert> = {};
  if (body.theme)      updates.theme      = body.theme;
  if (body.customTheme !== undefined) updates.customTheme = body.customTheme;
  if (body.appearance  !== undefined) updates.appearance  = body.appearance;

  await db
    .insert(workspaceSettings)
    .values({ workspaceId: workspace.id, ...updates })
    .onConflictDoUpdate({
      target: workspaceSettings.workspaceId,
      set:    updates,
    });

  return NextResponse.json({ data: { ok: true } });
}
```

---

## Step 3 - ThemeProvider Client Component

Create `src/components/shell/ThemeProvider.tsx`. This client component:
1. Reads the saved theme from the API on mount
2. Applies the CSS variables to `:root`
3. Listens for a custom `set-theme` event to switch themes without a page reload

```tsx
'use client';
import { useEffect } from 'react';
import { THEMES, DEFAULT_THEME, type ThemeTokens } from '@/lib/themes';

function applyTheme(tokens: ThemeTokens) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply saved theme on mount
    fetch('/api/workspace/settings')
      .then((r) => r.json())
      .then((d) => {
        const themeName = d.data?.theme ?? DEFAULT_THEME;
        const theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME];
        applyTheme(theme.tokens);
        document.documentElement.setAttribute('data-theme', themeName);
      })
      .catch(() => {
        applyTheme(THEMES[DEFAULT_THEME].tokens);
      });

    // Listen for live theme changes from the settings panel
    function handler(e: Event) {
      const themeName = (e as CustomEvent).detail as string;
      const theme = THEMES[themeName] ?? THEMES[DEFAULT_THEME];
      applyTheme(theme.tokens);
      document.documentElement.setAttribute('data-theme', themeName);
    }
    document.addEventListener('set-theme', handler);
    return () => document.removeEventListener('set-theme', handler);
  }, []);

  return <>{children}</>;
}
```

---

## Step 4 - Mount ThemeProvider in Root Layout

Update `src/app/layout.tsx` (the root layout, not the workspace layout) to wrap the body with `ThemeProvider`:

```tsx
import { ThemeProvider } from '@/components/shell/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`suppressHydrationWarning` is required because the server has no theme and the client applies one on mount.

---

## Step 5 - Theme Selector UI Component

Create `src/components/settings/ThemeSelector.tsx` for use in the Appearance settings page (Prompt 15):

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { THEMES, DEFAULT_THEME } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  currentTheme: string;
  onChange: (theme: string) => void;
}

export function ThemeSelector({ currentTheme, onChange }: ThemeSelectorProps) {
  function selectTheme(name: string) {
    onChange(name);
    document.dispatchEvent(new CustomEvent('set-theme', { detail: name }));
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Object.entries(THEMES).map(([name, def]) => {
        const t = def.tokens;
        const active = currentTheme === name;

        return (
          <button
            key={name}
            onClick={() => selectTheme(name)}
            className={cn(
              'relative rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02]',
              active ? 'border-accent shadow-lg shadow-accent/10' : 'border-border hover:border-border-focus',
            )}
            style={{ background: t['--bg-surface'] }}
          >
            {/* Mini preview */}
            <div className="mb-3 rounded-lg overflow-hidden" style={{ background: t['--bg-base'] }}>
              {/* Fake sidebar strip */}
              <div className="flex" style={{ height: 60 }}>
                <div className="w-8 shrink-0" style={{ background: t['--bg-surface'] }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="mx-1 mt-1.5 h-1.5 rounded-full" style={{ background: t['--border-subtle'], width: `${20 + i * 8}px` }} />
                  ))}
                </div>
                <div className="flex-1 flex flex-col justify-end p-1.5">
                  {/* Fake message bubbles */}
                  <div className="self-end mb-1 h-3 w-12 rounded-full" style={{ background: t['--bubble-user'] }} />
                  <div className="self-start h-3 w-16 rounded-full" style={{ background: t['--bubble-assistant'] }} />
                  {/* Fake input bar */}
                  <div className="mt-1.5 h-4 rounded" style={{ background: t['--bg-elevated'], border: `1px solid ${t['--border-subtle']}` }}>
                    <div className="ml-1.5 mt-1 h-1.5 w-8 rounded-full" style={{ background: t['--border-subtle'] }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Labels */}
            <p className="text-xs font-semibold" style={{ color: t['--text-primary'] }}>{def.label}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: t['--text-muted'] }}>{def.description}</p>

            {/* Accent swatch */}
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: t['--accent'] }} />
              <span className="text-[9px] font-mono" style={{ color: t['--text-muted'] }}>{t['--accent']}</span>
            </div>

            {/* Active checkmark */}
            {active && (
              <div className="absolute right-2 top-2 rounded-full p-0.5" style={{ background: t['--accent'] }}>
                <Check className="h-2.5 w-2.5 text-black" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

---

## Step 6 - Anti-FOUC Script in `<head>`

To prevent flash of wrong theme before the ThemeProvider mounts, add an inline script to `src/app/layout.tsx` that reads the saved theme from a cookie and applies it synchronously:

```tsx
// In <head>:
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var theme = document.cookie.match(/carina_theme=([^;]+)/)?.[1] ?? 'dark';
          var themes = ${JSON.stringify(Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.tokens])))};
          var tokens = themes[theme] ?? themes['dark'];
          var root = document.documentElement;
          Object.entries(tokens).forEach(function(e) { root.style.setProperty(e[0], e[1]); });
          root.setAttribute('data-theme', theme);
        } catch(e) {}
      })();
    `,
  }}
/>
```

Update the workspace settings PATCH to also set a `carina_theme` cookie in the response when the theme changes:

```ts
// In the PATCH response for theme changes:
const response = NextResponse.json({ data: { ok: true } });
if (body.theme) {
  response.cookies.set('carina_theme', body.theme, { maxAge: 60 * 60 * 24 * 365, path: '/' });
}
return response;
```

---

## Verification

After this prompt:
1. On first load, the Dark theme is applied immediately (no flash of unstyled content)
2. After changing theme in settings and reloading, the new theme persists
3. The ThemeSelector shows 4 theme cards with mini previews using actual token colours
4. Clicking a theme applies it instantly to the page (CSS variables on `:root` change)
5. The active theme has a green checkmark in the top right of its card
6. The selected theme is saved to the database via PATCH /api/workspace/settings
7. Dark theme: deep charcoal + green accent (matches existing design)
8. Light theme: white/grey surfaces + green accent (fully readable)
9. Midnight theme: pure black + blue accent
10. Forest theme: dark green surfaces + amber accent
11. TypeScript builds without errors
