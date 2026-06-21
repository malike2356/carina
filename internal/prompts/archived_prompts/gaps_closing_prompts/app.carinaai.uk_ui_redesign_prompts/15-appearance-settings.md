# Prompt 15 - Appearance Settings Page

## Objective

Build the full Appearance section inside `/settings`. This page gives users granular control over every visual behaviour of the app: theme selection, font size, message density, sidebar width, whether to show timestamps, typing indicators, token counts, and model badges. All settings persist to `workspaceSettings` and apply live without a page reload.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-14 complete. `workspaceSettings` table exists (Prompt 01). `ThemeSelector` exists (Prompt 14). `/api/workspace/settings` GET/PATCH routes exist (Prompt 14).

The existing `/settings/page.tsx` is a stub. This prompt replaces it with a fully sectioned settings page. Later prompts (Prompt 16) add the Shortcuts section to the same page.

---

## Step 1 - WorkspaceSettings Schema Clarification

The `workspaceSettings` table was specified in Prompt 01 with an `appearance` JSONB column. Clarify the shape of that column here:

```ts
interface AppearanceSettings {
  fontSize:          'xs' | 'sm' | 'base' | 'lg'; // chat text size
  messageDensity:    'compact' | 'comfortable' | 'spacious';
  sidebarCollapsed:  boolean; // default sidebar state
  showTimestamps:    boolean;
  showTokenCounts:   boolean;
  showModelBadge:    boolean;
  showTypingDots:    boolean;
  codeWordWrap:      boolean; // wrap long code lines
  animationsEnabled: boolean;
}

const APPEARANCE_DEFAULTS: AppearanceSettings = {
  fontSize:          'sm',
  messageDensity:    'comfortable',
  sidebarCollapsed:  false,
  showTimestamps:    false,
  showTokenCounts:   true,
  showModelBadge:    true,
  showTypingDots:    true,
  codeWordWrap:      false,
  animationsEnabled: true,
};
```

Save this type in `src/lib/appearance.ts`:

```ts
export interface AppearanceSettings {
  fontSize:          'xs' | 'sm' | 'base' | 'lg';
  messageDensity:    'compact' | 'comfortable' | 'spacious';
  sidebarCollapsed:  boolean;
  showTimestamps:    boolean;
  showTokenCounts:   boolean;
  showModelBadge:    boolean;
  showTypingDots:    boolean;
  codeWordWrap:      boolean;
  animationsEnabled: boolean;
}

export const APPEARANCE_DEFAULTS: AppearanceSettings = {
  fontSize:          'sm',
  messageDensity:    'comfortable',
  sidebarCollapsed:  false,
  showTimestamps:    false,
  showTokenCounts:   true,
  showModelBadge:    true,
  showTypingDots:    true,
  codeWordWrap:      false,
  animationsEnabled: true,
};

// CSS variables or class names driven by appearance settings
export function appearanceToCSS(a: AppearanceSettings): Record<string, string> {
  const fontSizes: Record<string, string> = {
    xs: '11px', sm: '12px', base: '14px', lg: '16px',
  };
  const densityGaps: Record<string, string> = {
    compact: '8px', comfortable: '16px', spacious: '28px',
  };
  return {
    '--chat-font-size':    fontSizes[a.fontSize]    ?? '12px',
    '--message-gap':       densityGaps[a.messageDensity] ?? '16px',
  };
}
```

---

## Step 2 - Apply Appearance Settings on Load

In `src/components/shell/ThemeProvider.tsx`, extend the fetch to also apply appearance CSS variables:

```ts
import { appearanceToCSS, APPEARANCE_DEFAULTS } from '@/lib/appearance';

// In the fetch handler, after applying theme:
const appearance = { ...APPEARANCE_DEFAULTS, ...(d.data?.appearance ?? {}) };
const appearanceCss = appearanceToCSS(appearance);
for (const [key, value] of Object.entries(appearanceCss)) {
  root.style.setProperty(key, value);
}
// Broadcast to components that need to react (timestamps visible etc)
document.dispatchEvent(new CustomEvent('appearance-changed', { detail: appearance }));
```

Also listen for `set-appearance` event (dispatched by the settings UI) to apply instantly:

```ts
document.addEventListener('set-appearance', (e) => {
  const a = (e as CustomEvent).detail as AppearanceSettings;
  const css = appearanceToCSS(a);
  for (const [key, value] of Object.entries(css)) {
    document.documentElement.style.setProperty(key, value);
  }
  document.dispatchEvent(new CustomEvent('appearance-changed', { detail: a }));
});
```

---

## Step 3 - Appearance Hook for Components

Create `src/hooks/useAppearance.ts` so any component can read current appearance settings reactively:

```ts
'use client';
import { useState, useEffect } from 'react';
import { AppearanceSettings, APPEARANCE_DEFAULTS } from '@/lib/appearance';

export function useAppearance(): AppearanceSettings {
  const [settings, setSettings] = useState<AppearanceSettings>(APPEARANCE_DEFAULTS);

  useEffect(() => {
    function handler(e: Event) {
      setSettings((e as CustomEvent).detail as AppearanceSettings);
    }
    document.addEventListener('appearance-changed', handler);
    return () => document.removeEventListener('appearance-changed', handler);
  }, []);

  return settings;
}
```

Use this hook in `MessageMetadata.tsx` (showTokenCounts) and `AssistantMessage.tsx` (showModelBadge, showTimestamps).

---

## Step 4 - Rewrite Settings Page

Replace `src/app/(workspace)/settings/page.tsx` with:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Monitor, MessageSquare, Zap, User, Bell, Shield, ChevronRight } from 'lucide-react';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { AppearanceSettings, APPEARANCE_DEFAULTS } from '@/lib/appearance';
import { THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

type Section = 'appearance' | 'chat' | 'account' | 'notifications' | 'security';

interface WorkspaceSettingsData {
  theme: string;
  appearance: Partial<AppearanceSettings>;
}

function Toggle({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
          value ? 'bg-accent' : 'bg-elevated border border-border',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
            value ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function RadioGroup<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs transition-colors',
            value === opt.value
              ? 'border-accent/40 bg-accent-dim text-accent'
              : 'border-border bg-elevated text-text-secondary hover:text-text-primary',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('appearance');
  const [wsSettings, setWsSettings] = useState<WorkspaceSettingsData>({ theme: 'dark', appearance: {} });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/workspace/settings')
      .then((r) => r.json())
      .then((d) => { if (d.data) setWsSettings(d.data); })
      .catch(() => {});
  }, []);

  const appearance: AppearanceSettings = { ...APPEARANCE_DEFAULTS, ...(wsSettings.appearance ?? {}) };

  async function saveSettings(updates: Partial<WorkspaceSettingsData>) {
    setSaving(true);
    const merged = { ...wsSettings, ...updates };
    if (updates.appearance) merged.appearance = { ...wsSettings.appearance, ...updates.appearance };
    setWsSettings(merged);

    await fetch('/api/workspace/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateAppearance(key: keyof AppearanceSettings, value: unknown) {
    const next = { ...appearance, [key]: value };
    document.dispatchEvent(new CustomEvent('set-appearance', { detail: next }));
    saveSettings({ appearance: { [key]: value } });
  }

  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance',    label: 'Appearance',    icon: <Monitor className="h-4 w-4" /> },
    { id: 'chat',          label: 'Chat',          icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'account',       label: 'Account',       icon: <User className="h-4 w-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
    { id: 'security',      label: 'Security',      icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <div className="flex h-full bg-base">
      {/* Settings sidebar */}
      <div className="w-52 shrink-0 border-r border-border flex flex-col pt-4">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Settings</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left',
              activeSection === item.id
                ? 'bg-elevated text-text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface',
            )}
          >
            <span className={cn('shrink-0', activeSection === item.id ? 'text-accent' : 'text-text-muted')}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Save indicator */}
        {(saving || saved) && (
          <div className={cn('fixed right-6 top-4 z-50 rounded-md px-3 py-1.5 text-xs font-medium transition-all', saving ? 'bg-elevated text-text-secondary' : 'bg-accent text-black')}>
            {saving ? 'Saving...' : 'Saved'}
          </div>
        )}

        <div className="max-w-2xl px-8 py-8">
          {/* Appearance section */}
          {activeSection === 'appearance' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Appearance</h2>
                <p className="text-xs text-text-muted">Customise how Carina looks and feels</p>
              </div>

              {/* Theme */}
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-4">Theme</h3>
                <ThemeSelector
                  currentTheme={wsSettings.theme}
                  onChange={(t) => {
                    setWsSettings((prev) => ({ ...prev, theme: t }));
                    saveSettings({ theme: t });
                  }}
                />
              </div>

              {/* Font size */}
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-medium text-text-secondary mb-2">Chat text size</h3>
                <RadioGroup
                  value={appearance.fontSize}
                  onChange={(v) => updateAppearance('fontSize', v)}
                  options={[
                    { value: 'xs',   label: 'Extra small' },
                    { value: 'sm',   label: 'Small' },
                    { value: 'base', label: 'Medium' },
                    { value: 'lg',   label: 'Large' },
                  ]}
                />
              </div>

              {/* Message density */}
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-medium text-text-secondary mb-2">Message spacing</h3>
                <RadioGroup
                  value={appearance.messageDensity}
                  onChange={(v) => updateAppearance('messageDensity', v)}
                  options={[
                    { value: 'compact',     label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'spacious',    label: 'Spacious' },
                  ]}
                />
              </div>

              {/* Toggle switches */}
              <div className="border-t border-border pt-6 divide-y divide-border">
                <h3 className="text-sm font-medium text-text-secondary mb-2">Display options</h3>
                <Toggle label="Show timestamps" description="Show message sent time next to each bubble" value={appearance.showTimestamps} onChange={(v) => updateAppearance('showTimestamps', v)} />
                <Toggle label="Show token counts" description="Display input/output token usage below assistant messages" value={appearance.showTokenCounts} onChange={(v) => updateAppearance('showTokenCounts', v)} />
                <Toggle label="Show model badge" description="Show which model generated each response" value={appearance.showModelBadge} onChange={(v) => updateAppearance('showModelBadge', v)} />
                <Toggle label="Typing animation" description="Show animated dots while Carina is responding" value={appearance.showTypingDots} onChange={(v) => updateAppearance('showTypingDots', v)} />
                <Toggle label="Code word wrap" description="Wrap long lines in code blocks instead of scrolling" value={appearance.codeWordWrap} onChange={(v) => updateAppearance('codeWordWrap', v)} />
                <Toggle label="Animations" description="Enable slide and fade transitions throughout the app" value={appearance.animationsEnabled} onChange={(v) => updateAppearance('animationsEnabled', v)} />
              </div>
            </div>
          )}

          {/* Chat section */}
          {activeSection === 'chat' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Chat</h2>
                <p className="text-xs text-text-muted">Control how the chat interface behaves</p>
              </div>
              <div className="divide-y divide-border">
                <Toggle
                  label="Start sidebar collapsed"
                  description="Load the app with the left sidebar in icon-only mode"
                  value={appearance.sidebarCollapsed}
                  onChange={(v) => updateAppearance('sidebarCollapsed', v)}
                />
              </div>
              {/* Chat settings link to keys page */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-primary">API Keys (BYOK)</p>
                    <p className="text-xs text-text-muted mt-0.5">Manage your bring-your-own-key API credentials</p>
                  </div>
                  <a href="/settings/keys" className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover">
                    Manage <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Account section (placeholder - links to profile actions) */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-text-primary mb-1">Account</h2>
                <p className="text-xs text-text-muted">Manage your account and billing</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Billing and plan', desc: 'View your current plan and invoices', href: '/billing' },
                  { label: 'Security',         desc: 'Password, sessions, and 2FA',         href: '/security' },
                ].map((item) => (
                  <a key={item.href} href={item.href} className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-elevated transition-colors">
                    <div>
                      <p className="text-sm text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notifications and Security: stubs with coming soon */}
          {(activeSection === 'notifications' || activeSection === 'security') && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-text-primary capitalize">{activeSection}</h2>
              <div className="rounded-lg border border-border bg-surface px-6 py-8 text-center">
                <p className="text-sm text-text-muted">
                  {activeSection === 'notifications' ? 'Notification preferences coming soon.' : ''}
                  {activeSection === 'security' ? (
                    <>
                      See <a href="/security" className="text-accent hover:underline">/security</a> for session management and password settings.
                    </>
                  ) : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 5 - Apply Appearance Variables in CSS

Add to `src/app/globals.css`:

```css
/* Driven by AppearanceSettings via JS */
:root {
  --chat-font-size: 12px;
  --message-gap:    16px;
}

/* Apply to chat bubbles */
.chat-message-content {
  font-size: var(--chat-font-size);
}

.chat-messages {
  gap: var(--message-gap);
}
```

In `ChatView.tsx`, add `chat-messages` class to the messages container `<div>` and `chat-message-content` to the content area within each bubble.

---

## Verification

After this prompt:
1. `/settings` loads with a left nav sidebar (Appearance, Chat, Account, Notifications, Security)
2. Appearance section shows the `ThemeSelector` with 4 theme cards
3. Clicking a theme applies it instantly to the entire page
4. Font size radio (XS/Small/Medium/Large) changes chat text size via CSS variable
5. Message spacing radio changes gap between messages via CSS variable
6. All 6 toggle switches work and save immediately
7. Toggle changes take effect live (no page reload needed)
8. "Saved" indicator flashes in the top right after each change
9. Settings persist across page reloads (fetched from /api/workspace/settings on mount)
10. Chat section shows the BYOK keys link card
11. Account section shows links to Billing and Security
12. TypeScript builds without errors
