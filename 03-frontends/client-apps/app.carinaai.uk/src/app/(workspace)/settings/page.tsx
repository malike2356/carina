'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Bell,
  Brain,
  ChevronRight,
  Keyboard,
  Link2,
  MessageSquare,
  Monitor,
  Palette,
  Shield,
  User,
} from 'lucide-react';
import { BrandSettings } from '@/components/settings/BrandSettings';
import { SsoSettings } from '@/components/settings/SsoSettings';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { SettingsToolLinks } from '@/components/settings/SettingsToolLinks';
import { AgentSyncSettings } from '@/components/settings/AgentSyncSettings';
import { Kbd } from '@/components/ui/Kbd';
import {
  APPEARANCE_DEFAULTS,
  type AppearanceSettings,
  normalizeAppearance,
} from '@/lib/appearance';
import { BRAIN_SETTINGS_DEFAULTS, type BrainSettings } from '@/lib/brain-settings-types';
import { normalizeBrandConfig, type BrandConfig } from '@/lib/brand';
import { DEFAULT_THEME, isThemeName } from '@/lib/themes';
import { groupShortcuts } from '@/lib/shortcuts';
import { SETTINGS_SECTION_LINKS, type SettingsSectionId } from '@/lib/workspace-nav';
import { useTerminalAccess } from '@/hooks/useTerminalAccess';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { useTranslation } from '@/i18n/translate';
import { cn } from '@/lib/utils';

type Section = SettingsSectionId;

interface WorkspaceSettingsData {
  theme: string;
  appearance: AppearanceSettings;
  brain: BrainSettings;
  brand: BrandConfig;
  emailIngestionEnabled: boolean;
  emailIngestionManagedByCore: boolean;
}

type NotificationSettings = {
  browser: boolean;
  sound: boolean;
  taskDigest: boolean;
};

const NOTIFICATION_STORAGE_KEY = 'carina.notification-settings';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  browser: true,
  sound: false,
  taskDigest: true,
};

function LanguageSection() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="mb-1 text-sm font-medium text-text-secondary">{t('settings.language')}</h2>
        <p className="text-xs text-text-muted">{t('settings.languageDescription')}</p>
      </div>
      <LanguageSwitcher />
    </div>
  );
}

function Toggle({
  value,
  onChange,
  label,
  description,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary">{label}</p>
        {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          value ? 'bg-accent' : 'border-border bg-elevated',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            value ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs transition-colors',
            value === option.value
              ? 'border-accent/40 bg-accent-dim text-accent'
              : 'border-border bg-elevated text-text-secondary hover:text-text-primary',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');
  const validSections = new Set<Section>([
    'join',
    'appearance',
    'brand',
    'chat',
    'brain',
    'shortcuts',
    'account',
    'notifications',
    'security',
  ]);
  const [activeSection, setActiveSection] = useState<Section>(() => {
    if (sectionParam && validSections.has(sectionParam as Section)) {
      return sectionParam as Section;
    }
    return 'appearance';
  });
  const { canUseTerminal } = useTerminalAccess();
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettingsData>({
    theme: DEFAULT_THEME,
    appearance: APPEARANCE_DEFAULTS,
    brain: BRAIN_SETTINGS_DEFAULTS,
    brand: {},
    emailIngestionEnabled: false,
    emailIngestionManagedByCore: false,
  });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [terminalEnabled, setTerminalEnabled] = useState(true);
  const [members, setMembers] = useState<Array<{
    userId: string;
    userName?: string;
    userEmail?: string;
    permissions?: Record<string, unknown>;
  }>>([]);
  const [auditEntries, setAuditEntries] = useState<Array<{
    id: string;
    userEmail: string;
    command: string;
    exitCode: number | null;
    executedAt: string;
  }>>([]);

  useEffect(() => {
    if (sectionParam && validSections.has(sectionParam as Section)) {
      setActiveSection(sectionParam as Section);
    }
  }, [sectionParam]);

  useEffect(() => {
    if (activeSection !== 'brain') return;
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#agent-sync') return;
    const timer = window.setTimeout(() => {
      document.getElementById('agent-sync')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeSection]);

  useEffect(() => {
    fetch('/api/workspace/settings')
      .then((response) => response.json())
      .then((data) => {
        if (!data.data) return;
        setWorkspaceSettings({
          theme: isThemeName(data.data.theme) ? data.data.theme : DEFAULT_THEME,
          appearance: normalizeAppearance(data.data.appearance),
          brand: normalizeBrandConfig(data.data.brand ?? {}),
          emailIngestionEnabled: Boolean(data.data.emailIngestionEnabled),
          emailIngestionManagedByCore: Boolean(data.data.emailIngestionManagedByCore),
          brain: {
            autoExtractMemories:
              data.data.autoExtractMemories ?? BRAIN_SETTINGS_DEFAULTS.autoExtractMemories,
            autoExtractSkills:
              data.data.autoExtractSkills ?? BRAIN_SETTINGS_DEFAULTS.autoExtractSkills,
            autoApproveSkillsMinConfidence:
              data.data.autoApproveSkillsMinConfidence ??
              BRAIN_SETTINGS_DEFAULTS.autoApproveSkillsMinConfidence,
            maxSkillsPerRequest:
              data.data.maxSkillsPerRequest ?? BRAIN_SETTINGS_DEFAULTS.maxSkillsPerRequest,
            injectMemoriesInChat:
              data.data.injectMemoriesInChat ?? BRAIN_SETTINGS_DEFAULTS.injectMemoriesInChat,
          },
        });
        setIsOwner(Boolean(data.data.isOwner));
        setTerminalEnabled(data.data.terminalEnabled !== false);
        setMembers(Array.isArray(data.data.members) ? data.data.members : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/terminal/audit?limit=50')
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.data)) setAuditEntries(data.data);
      })
      .catch(() => {});
  }, [isOwner, terminalEnabled]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
      setNotificationSettings({
        browser:
          typeof parsed.browser === 'boolean' ? parsed.browser : DEFAULT_NOTIFICATION_SETTINGS.browser,
        sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_NOTIFICATION_SETTINGS.sound,
        taskDigest:
          typeof parsed.taskDigest === 'boolean'
            ? parsed.taskDigest
            : DEFAULT_NOTIFICATION_SETTINGS.taskDigest,
      });
    } catch {
      // ignore malformed local prefs
    }
  }, []);

  async function saveSettings(payload: Record<string, unknown>) {
    const previousSettings = workspaceSettings;
    setSaving(true);
    setSaved(false);

    try {
      if (typeof payload.theme === 'string') {
        setWorkspaceSettings((current) => ({ ...current, theme: payload.theme as string }));
      }
      if (payload.appearance && typeof payload.appearance === 'object') {
        setWorkspaceSettings((current) => ({
          ...current,
          appearance: normalizeAppearance({
            ...current.appearance,
            ...(payload.appearance as AppearanceSettings),
          }),
        }));
      }
      const brainKeys = [
        'autoExtractMemories',
        'autoExtractSkills',
        'autoApproveSkillsMinConfidence',
        'maxSkillsPerRequest',
        'injectMemoriesInChat',
      ] as const;
      const brainPatch = Object.fromEntries(
        brainKeys.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]),
      );
      if (Object.keys(brainPatch).length > 0) {
        setWorkspaceSettings((current) => ({
          ...current,
          brain: { ...current.brain, ...brainPatch } as BrainSettings,
        }));
      }
      if (payload.brand && typeof payload.brand === 'object') {
        setWorkspaceSettings((current) => ({
          ...current,
          brand: normalizeBrandConfig(payload.brand),
        }));
      }
      if (typeof payload.emailIngestionEnabled === 'boolean') {
        setWorkspaceSettings((current) => ({
          ...current,
          emailIngestionEnabled: payload.emailIngestionEnabled as boolean,
        }));
      }

      const response = await fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'Could not save settings');
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setWorkspaceSettings(previousSettings);
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function updateAppearance<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    const next = normalizeAppearance({ ...workspaceSettings.appearance, [key]: value });
    document.dispatchEvent(new CustomEvent('set-appearance', { detail: next }));
    void saveSettings({ appearance: { [key]: value } });
  }

  function updateBrain<K extends keyof BrainSettings>(key: K, value: BrainSettings[K]) {
    setWorkspaceSettings((current) => ({
      ...current,
      brain: { ...current.brain, [key]: value },
    }));
    void saveSettings({ [key]: value });
  }

  function updateNotifications<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setNotificationSettings((current) => {
      const next = { ...current, [key]: value };
      try {
        window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  const navItems: Array<{ id: Section; label: string; icon: ReactNode }> = [
    { id: 'join', label: 'Join', icon: <Link2 className="h-4 w-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Monitor className="h-4 w-4" /> },
    { id: 'brand', label: 'Brand', icon: <Palette className="h-4 w-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'brain', label: 'Brain', icon: <Brain className="h-4 w-4" /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="h-4 w-4" /> },
    { id: 'account', label: 'Account', icon: <User className="h-4 w-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="h-4 w-4" /> },
  ];

  const appearance = workspaceSettings.appearance;
  const brain = workspaceSettings.brain;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden bg-base">
      <nav
        aria-label="Settings sections"
        className="sticky top-0 z-20 shrink-0 border-b border-border bg-base"
      >
        <div className="-mx-px flex gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-elevated text-text-primary'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary',
                )}
              >
                <span className={active ? 'text-accent' : 'text-text-muted'}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {(saving || saved) && (
          <div
            className={cn(
              'fixed right-4 top-16 z-50 rounded-md px-3 py-1.5 text-xs font-medium transition-colors lg:right-6 lg:top-4',
              saving ? 'bg-elevated text-text-secondary' : 'bg-accent text-black',
            )}
          >
            {saving ? 'Saving...' : 'Saved'}
          </div>
        )}

        <div className="w-full min-w-0 max-w-none px-4 py-6 sm:px-6 lg:px-8">
          {activeSection === 'join' && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Join</h1>
                <p className="text-xs text-text-muted">
                  Connect channels, calendars, Trello, and devices to this workspace.
                </p>
              </div>
              <SettingsToolLinks items={SETTINGS_SECTION_LINKS.join} />
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="space-y-8">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Appearance</h1>
                <p className="text-xs text-text-muted">Customise theme and layout for your workspace shell.</p>
              </div>

              <section>
                <h2 className="mb-4 text-sm font-medium text-text-secondary">Theme</h2>
                <ThemeSelector
                  currentTheme={workspaceSettings.theme}
                  onChange={(theme) => {
                    setWorkspaceSettings((current) => ({ ...current, theme }));
                    void saveSettings({ theme });
                  }}
                />
              </section>

              <section className="border-t border-border pt-6">
                <LanguageSection />
              </section>

              <section className="border-t border-border pt-6">
                <h2 className="mb-2 text-sm font-medium text-text-secondary">Chat text size</h2>
                <RadioGroup
                  value={appearance.fontSize}
                  onChange={(value) => updateAppearance('fontSize', value)}
                  options={[
                    { value: 'xs', label: 'Extra small' },
                    { value: 'sm', label: 'Small' },
                    { value: 'base', label: 'Medium' },
                    { value: 'lg', label: 'Large' },
                  ]}
                />
              </section>

              <section className="border-t border-border pt-6">
                <h2 className="mb-2 text-sm font-medium text-text-secondary">Message spacing</h2>
                <RadioGroup
                  value={appearance.messageDensity}
                  onChange={(value) => updateAppearance('messageDensity', value)}
                  options={[
                    { value: 'compact', label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'spacious', label: 'Spacious' },
                  ]}
                />
              </section>

              <section className="border-t border-border pt-6">
                <h2 className="mb-2 text-sm font-medium text-text-secondary">Display options</h2>
                <div className="divide-y divide-border">
                  <Toggle
                    label="Show timestamps"
                    description="Show message sent time next to each bubble."
                    value={appearance.showTimestamps}
                    onChange={(value) => updateAppearance('showTimestamps', value)}
                  />
                  <Toggle
                    label="Show token counts"
                    description="Display input and output token usage below assistant messages."
                    value={appearance.showTokenCounts}
                    onChange={(value) => updateAppearance('showTokenCounts', value)}
                  />
                  <Toggle
                    label="Show model badge"
                    description="Show which model generated each response."
                    value={appearance.showModelBadge}
                    onChange={(value) => updateAppearance('showModelBadge', value)}
                  />
                  <Toggle
                    label="Typing animation"
                    description="Show animated dots while Carina is responding."
                    value={appearance.showTypingDots}
                    onChange={(value) => updateAppearance('showTypingDots', value)}
                  />
                  <Toggle
                    label="Code word wrap"
                    description="Wrap long lines in code blocks instead of horizontal scrolling."
                    value={appearance.codeWordWrap}
                    onChange={(value) => updateAppearance('codeWordWrap', value)}
                  />
                  <Toggle
                    label="Animations"
                    description="Enable slide and fade transitions throughout the app."
                    value={appearance.animationsEnabled}
                    onChange={(value) => updateAppearance('animationsEnabled', value)}
                  />
                </div>
              </section>
            </div>
          )}

          {activeSection === 'brand' && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Brand</h1>
                <p className="text-xs text-text-muted">
                  Workspace identity and Business plan widget white-label options.
                </p>
              </div>
              <BrandSettings
                brand={workspaceSettings.brand}
                isOwner={isOwner}
                onSave={async (patch) => {
                  setWorkspaceSettings((current) => ({
                    ...current,
                    brand: normalizeBrandConfig({ ...current.brand, ...patch }),
                  }));
                  await saveSettings({ brand: patch });
                }}
              />
              <SettingsToolLinks items={SETTINGS_SECTION_LINKS.brand} />
            </div>
          )}

          {activeSection === 'brain' && (
            <div className="space-y-8">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Brain</h1>
                <p className="max-w-2xl text-xs text-text-muted">
                  Memory capture and prompt hints from chat. Skill notes are not executable tools on cloud.
                </p>
              </div>

              <section className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
                <Toggle
                  label="Auto-extract memories"
                  description="Save useful facts from conversations to Memory."
                  value={brain.autoExtractMemories}
                  onChange={(value) => updateBrain('autoExtractMemories', value)}
                />
                <Toggle
                  label="Inject memories in chat"
                  description="Include saved memories in the system prompt for each message."
                  value={brain.injectMemoriesInChat}
                  onChange={(value) => updateBrain('injectMemoriesInChat', value)}
                />
                <Toggle
                  label="Auto-extract skills"
                  description="Save short procedure notes from chat (prompt hints only on cloud)."
                  value={brain.autoExtractSkills}
                  onChange={(value) => updateBrain('autoExtractSkills', value)}
                />
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface px-4 py-4">
                  <label className="block text-sm text-text-primary">
                    Auto-approve skills at or above
                    <span className="ml-2 text-accent">{brain.autoApproveSkillsMinConfidence}%</span>
                  </label>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Learned skill notes above this confidence are enabled automatically.
                  </p>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={brain.autoApproveSkillsMinConfidence}
                    onChange={(e) =>
                      updateBrain('autoApproveSkillsMinConfidence', Number(e.target.value))
                    }
                    className="mt-3 w-full accent-accent"
                  />
                </div>
                <div className="rounded-lg border border-border bg-surface px-4 py-4">
                  <label className="block text-sm text-text-primary" htmlFor="max-skills">
                    Max skills per request
                  </label>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Cap how many learned skill notes are added to each chat system prompt.
                  </p>
                  <input
                    id="max-skills"
                    type="number"
                    min={1}
                    max={10}
                    value={brain.maxSkillsPerRequest}
                    onChange={(e) =>
                      updateBrain(
                        'maxSkillsPerRequest',
                        Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                      )
                    }
                    className="mt-3 w-24 rounded-md border border-border bg-elevated px-2 py-1.5 text-sm text-text-primary"
                  />
                </div>
              </section>

              <AgentSyncSettings embedded />

              <section>
                <h2 className="mb-3 text-sm font-medium text-text-secondary">Memory and skills</h2>
                <SettingsToolLinks items={SETTINGS_SECTION_LINKS.brain} />
              </section>
            </div>
          )}

          {activeSection === 'chat' && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Chat</h1>
                <p className="text-xs text-text-muted">Control how the chat interface behaves.</p>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
                <Toggle
                  label="Start sidebar collapsed"
                  description="Load the app with the left sidebar in icon-only mode."
                  value={appearance.sidebarCollapsed}
                  onChange={(value) => updateAppearance('sidebarCollapsed', value)}
                />
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-primary">API keys</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Manage your bring-your-own-key API credentials.
                    </p>
                  </div>
                  <Link
                    href="/settings/keys"
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                  >
                    Manage
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <section>
                <h2 className="mb-3 text-sm font-medium text-text-secondary">Workspace tools</h2>
                <SettingsToolLinks items={SETTINGS_SECTION_LINKS.chat} />
              </section>
            </div>
          )}

          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Account</h1>
                <p className="text-xs text-text-muted">Manage your account and billing.</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-primary">Password</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Change your sign-in password or send a reset link to your email.
                    </p>
                  </div>
                  <Link
                    href="/settings/password"
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                  >
                    Manage
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
              <SettingsToolLinks items={SETTINGS_SECTION_LINKS.account} />
            </div>
          )}

          {activeSection === 'shortcuts' && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Keyboard shortcuts</h1>
                <p className="text-xs text-text-muted">
                  Press <Kbd>?</Kbd> anywhere outside an input to see this list as an overlay.
                </p>
              </div>
              {Object.entries(groupShortcuts()).map(([category, shortcuts]) => (
                <section key={category} className="border-t border-border pt-4">
                  <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
                    {category}
                  </h2>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut) => (
                      <div key={shortcut.id} className="flex items-center justify-between gap-4 py-1.5">
                        <div>
                          <p className="text-sm text-text-primary">{shortcut.label}</p>
                          <p className="mt-0.5 text-[11px] text-text-muted">{shortcut.description}</p>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-0.5">
                          {shortcut.keys.map((key, index) => (
                            <span key={`${shortcut.id}-${key}-${index}`} className="flex items-center gap-0.5">
                              {index > 0 && <span className="text-[10px] text-text-muted">+</span>}
                              <Kbd>{key}</Kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Notifications</h1>
                <p className="text-xs text-text-muted">
                  Browser notification preferences are stored locally in this workspace shell.
                </p>
              </div>
              <div className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
                <Toggle
                  value={notificationSettings.browser}
                  onChange={(value) => updateNotifications('browser', value)}
                  label="Desktop notifications"
                  description="Show browser notifications for important workspace events when the browser allows it."
                />
                <Toggle
                  value={notificationSettings.sound}
                  onChange={(value) => updateNotifications('sound', value)}
                  label="Sound alerts"
                  description="Play a short sound for incoming alerts and completed background work."
                />
                <Toggle
                  value={notificationSettings.taskDigest}
                  onChange={(value) => updateNotifications('taskDigest', value)}
                  label="Task digest"
                  description="Group task and automation updates into a single digest rather than showing each event separately."
                />
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-6">
              <div>
                <h1 className="mb-1 text-base font-semibold text-text-primary">Security</h1>
                <p className="text-xs text-text-muted">
                  Trust, integrations, and advanced workspace tools.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-text-primary">Incident blog dashboard</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Move incident discovery, auto-approval, publish thresholds, and newsletter dispatch here.
                    </p>
                  </div>
                  <Link
                    href="/incident-blog"
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                  >
                    Open
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
                <Toggle
                  value={workspaceSettings.emailIngestionEnabled}
                  onChange={(value) => {
                    if (!workspaceSettings.emailIngestionManagedByCore) return;
                    void saveSettings({ emailIngestionEnabled: value });
                  }}
                  label="Email ingestion"
                  description={
                    workspaceSettings.emailIngestionManagedByCore
                      ? 'Allow this workspace to use the core email ingestion gate.'
                      : 'Connect the core bridge to manage this setting from the GUI.'
                  }
                  disabled={!workspaceSettings.emailIngestionManagedByCore}
                />
              </div>

              <SettingsToolLinks
                items={SETTINGS_SECTION_LINKS.security}
                canUseTerminal={canUseTerminal}
              />

              <SsoSettings isOwner={isOwner} />

              {isOwner ? (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <h2 className="mb-1 text-sm font-semibold text-text-primary">Terminal access</h2>
                  <p className="mb-3 text-xs text-text-muted">
                    Master switch for sandboxed shell access. Individual links are under Security tools above.
                  </p>
                  <Toggle
                    value={terminalEnabled}
                    onChange={(value) => {
                      setTerminalEnabled(value);
                      void saveSettings({ terminalEnabled: value });
                    }}
                    label="Enable terminal for this workspace"
                    description="When off, nobody in this workspace can use the terminal."
                  />
                  {members.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                        Member access
                      </p>
                      {members.map((member) => (
                        <Toggle
                          key={member.userId}
                          value={member.permissions?.terminal === true}
                          onChange={(value) => {
                            void saveSettings({ memberUserId: member.userId, memberTerminal: value });
                            setMembers((current) => current.map((row) => (
                              row.userId === member.userId
                                ? { ...row, permissions: { ...row.permissions, terminal: value } }
                                : row
                            )));
                          }}
                          label={`Terminal for ${member.userName || member.userEmail || member.userId.slice(0, 8)}`}
                          description={
                            member.userEmail
                              ? `${member.userEmail}. Collaborators need explicit permission.`
                              : 'Collaborators need explicit permission. Owners always have access when enabled.'
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                      Terminal audit log
                    </p>
                    {auditEntries.length === 0 ? (
                      <p className="text-xs text-text-muted">No terminal commands logged yet.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-base">
                        {auditEntries.map((entry) => (
                          <div key={entry.id} className="border-b border-border px-3 py-2 last:border-b-0">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                              <span>{entry.userEmail}</span>
                              <span>{new Date(entry.executedAt).toLocaleString()}</span>
                            </div>
                            <p className="mt-1 font-mono text-xs text-text-primary">{entry.command}</p>
                            <p className="text-[11px] text-text-muted">
                              exit {entry.exitCode == null ? 'n/a' : entry.exitCode}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
