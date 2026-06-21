# Web UI Upgrade 03; OpenClaw Internationalization (i18n)

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Source:** OpenClaw (`ui/src/i18n/`; 20 languages)
**Status:** Missing in Carina web UI
**Effort:** 3 weeks

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## SPECIFICATION

### What This Is

OpenClaw supports 20 languages in its web UI: Arabic, German, English, Spanish, Farsi, French, Indonesian, Italian, Japanese, Korean, Dutch, Polish, Portuguese (Brazil), Thai, Turkish, Ukrainian, Vietnamese, Chinese (Simplified), Chinese (Traditional).

Carina should adopt the same i18n architecture. Carina already has `src/i18n/index.ts` and `locales/`; extend this to the web UI.

### Architecture (OpenClaw Pattern)

```
ui/src/i18n/
├── index.ts; i18n initialization
├── lib/
│   ├── registry.ts; language registry
│   ├── translate.ts; translation function
│   ├── lit-controller.ts; Lit-specific reactive controller
│   └── types.ts; type definitions
└── locales/
    ├── en.ts; English (base)
    ├── de.ts; German
    ├── fr.ts; French
    ├── es.ts; Spanish
    ├── it.ts; Italian
    ├── ja-JP.ts; Japanese
    ├── ko.ts; Korean
    ├── zh-CN.ts; Chinese Simplified
    ├── zh-TW.ts; Chinese Traditional
    └── ... (11 more)
```

### Carina i18n Architecture (Next.js)

Adapt OpenClaw's pattern for Next.js App Router:

```
app.carinaai.uk/src/
├── i18n/
│   ├── index.ts; initialization + language detection
│   ├── translate.ts; translation function (useTranslation hook)
│   ├── registry.ts; language registry with metadata
│   ├── types.ts; type-safe translation keys
│   └── locales/
│       ├── en.ts; English (base, all keys defined here)
│       ├── es.ts; Spanish
│       ├── fr.ts; French
│       ├── de.ts; German
│       ├── ja.ts; Japanese
│       ├── ko.ts; Korean
│       ├── zh.ts; Chinese Simplified
│       └── ... (expand to 12+ languages)
```

---

## IMPLEMENTATION

### 1. Translation Key Structure

Define ALL UI strings as typed keys in `en.ts`:

```typescript
// i18n/locales/en.ts
const en = {
  // Navigation
  nav: {
    dashboard: 'Dashboard',
    chat: 'Chat',
    terminal: 'Terminal',
    research: 'Research',
    library: 'Library',
    documents: 'Documents',
    email: 'Email',
    calendar: 'Calendar',
    tasks: 'Tasks',
    notes: 'Notes',
    memories: 'Memories',
    skills: 'Skills',
    settings: 'Settings',
    billing: 'Billing',
    security: 'Security',
    admin: 'Admin',
    cron: 'Cron Jobs',
    webhooks: 'Webhooks',
    analytics: 'Analytics',
    logs: 'Logs',
    mcp: 'MCP Servers',
    files: 'Files',
    environment: 'Environment',
    system: 'System Health',
    profiles: 'Profiles',
  },

  // Chat
  chat: {
    placeholder: 'Message Carina...',
    send: 'Send',
    attach: 'Attach file',
    voice: 'Voice input',
    stopGeneration: 'Stop generating',
    regenerate: 'Regenerate',
    copyMessage: 'Copy message',
    copyAsMarkdown: 'Copy as Markdown',
    deleteMessage: 'Delete message',
    messageDeleted: 'This message was deleted',
    thinking: 'Thinking...',
    toolCall: 'Running {tool}...',
    toolComplete: '{tool} completed',
    toolError: '{tool} failed: {error}',
    approvalRequest: 'Carina wants to run: {command}',
    approve: 'Approve',
    deny: 'Deny',
    clarifyRequest: 'Carina needs clarification',
    submit: 'Submit',
    cancel: 'Cancel',
    contextWarning: 'Context window {percent}% full',
    heartbeat: 'Carina is checking in...',
    heartbeatOk: 'All clear',
    offline: 'You are offline. Messages will be sent when reconnected.',
    empty: 'Start a conversation with Carina',
    error: 'Failed to send message. Retry?',
    retry: 'Retry',
    exportChat: 'Export chat',
    exportStarted: 'Export started. Download will begin shortly.',
  },

  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    refresh: 'Refresh',
    loading: 'Loading...',
    error: 'Something went wrong',
    retry: 'Retry',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',
    copy: 'Copy',
    copied: 'Copied!',
    download: 'Download',
    upload: 'Upload',
    more: 'More',
    noResults: 'No results found',
    showing: 'Showing {from}-{to} of {total}',
    selected: '{count} selected',
    actions: 'Actions',
  },

  // Time
  time: {
    now: 'just now',
    minutesAgo: '{n}m ago',
    hoursAgo: '{n}h ago',
    daysAgo: '{n}d ago',
    weeksAgo: '{n}w ago',
    monthsAgo: '{n}mo ago',
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
  },

  // Models
  models: {
    title: 'Models',
    provider: 'Provider',
    model: 'Model',
    contextWindow: 'Context: {tokens} tokens',
    pricing: '{input}/M in · {output}/M out',
    expensive: 'This model is expensive (${cost}/M tokens)',
    cheaperAlternative: 'Try {model} instead?',
    selectModel: 'Select model',
    defaultModel: 'Default model',
    perTaskModel: 'Per-task model override',
  },

  // Billing
  billing: {
    title: 'Billing',
    currentPlan: 'Current plan',
    usage: 'Usage this month',
    credits: 'Credits remaining',
    upgrade: 'Upgrade',
    downgrade: 'Downgrade',
    invoices: 'Invoices',
    paymentMethod: 'Payment method',
    addPaymentMethod: 'Add payment method',
    costBreakdown: 'Cost breakdown',
    tokensUsed: '{tokens} tokens used',
    sessionsCount: '{count} sessions',
    avgCostPerSession: '${cost}/session avg',
  },

  // Errors
  errors: {
    notFound: 'Page not found',
    unauthorized: 'You are not authorized',
    sessionExpired: 'Session expired. Please log in again.',
    networkError: 'Network error. Check your connection.',
    serverError: 'Server error. Try again later.',
    validationError: 'Please fix the errors below.',
    rateLimited: 'Too many requests. Please wait.',
  },
} as const;

export default en;
export type Translations = typeof en;
```

**Study reference:** `openclaw/ui/src/i18n/locales/en.ts` (the base locale).

### 2. Translation Hook

```typescript
// i18n/translate.ts
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { Translations } from './locales/en';

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string ? `${K}` | `${K}.${NestedKeyOf<T[K]>}` : never }[keyof T]
  : never;

type TranslationKey = NestedKeyOf<Translations>;

interface I18nContext {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  locale: string;
  setLocale: (locale: string) => void;
  locales: { code: string; name: string; nativeName: string }[];
}

const I18nContext = createContext<I18nContext>(null!);

// Language metadata
export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
] as const;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState('en');
  const [messages, setMessages] = useState<Translations | null>(null);

  useEffect(() => {
    // Detect language: localStorage → browser preference → 'en'
    const stored = localStorage.getItem('carina-locale');
    const browser = navigator.language.split('-')[0];
    const detected = stored || (LANGUAGES.some(l => l.code === browser) ? browser : 'en');
    setLocaleState(detected);
  }, []);

  useEffect(() => {
    // Dynamic import of locale file
    import(`./locales/${locale}.ts`)
      .then(m => setMessages(m.default))
      .catch(() => import('./locales/en.ts').then(m => setMessages(m.default)));
  }, [locale]);

  const setLocale = (newLocale: string) => {
    localStorage.setItem('carina-locale', newLocale);
    setLocaleState(newLocale);
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    if (!messages) return key;
    const keys = key.split('.');
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    if (typeof value !== 'string') return key;
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
    }
    return value;
  };

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, locales: [...LANGUAGES] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
```

### 3. Language Switcher Component

```tsx
// components/LanguageSwitcher.tsx
'use client';

import { useTranslation, LANGUAGES } from '@/i18n/translate';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
      className="text-sm bg-transparent border rounded px-2 py-1"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeName}
        </option>
      ))}
    </select>
  );
}
```

Place in settings page and/or sidebar footer.

### 4. Usage in Components

```tsx
// Example: ChatInputBar.tsx
import { useTranslation } from '@/i18n/translate';

export function ChatInputBar() {
  const { t } = useTranslation();

  return (
    <div>
      <textarea placeholder={t('chat.placeholder')} />
      <button aria-label={t('chat.send')}>{t('chat.send')}</button>
      <button aria-label={t('chat.voice')}>{t('chat.voice')}</button>
    </div>
  );
}
```

### 5. Locale Files (start with 3, expand to 12)

```
Phase 1 (Week 1-2): en.ts (complete base) + es.ts + fr.ts
Phase 2 (Week 2-3): de.ts + ja.ts + ko.ts + zh.ts
Phase 3 (Week 3): ar.ts + pt.ts + it.ts + nl.ts + pl.ts
```

Each locale file is a partial copy of `en.ts` with translated values. Use TypeScript's `Partial<Translations>` to allow incremental translation; missing keys fall back to English.

```typescript
// i18n/locales/es.ts
import type { Translations } from './en';

const es: Partial<Translations> = {
  nav: {
    dashboard: 'Panel',
    chat: 'Chat',
    settings: 'Configuración',
    // ... more translations
  },
  chat: {
    placeholder: 'Mensaje a Carina...',
    send: 'Enviar',
    // ... more translations
  },
};

export default es;
```

---

## IMPLEMENTATION PLAN

### Week 1; Infrastructure
```
- Create i18n/ directory with all infrastructure files
- Define complete en.ts base translation (ALL keys)
- Create translate.ts with useTranslation hook
- Create I18nProvider and wrap root layout
- Create LanguageSwitcher component
- Add to settings page and sidebar
```

### Week 2; First Languages + Migration
```
- Translate es.ts (Spanish); most important second language
- Translate fr.ts (French)
- Migrate 50% of existing components to useTranslation()
- Update AppSidebar, chat components, common components
```

### Week 3; Remaining Languages + Completion
```
- Translate de.ts, ja.ts, ko.ts, zh.ts
- Translate ar.ts (RTL support for Arabic)
- Migrate remaining components
- Add RTL CSS support for Arabic
- Add language detection from browser preference
- Test all pages in all languages
```

---

## RTL SUPPORT

For Arabic (and future RTL languages like Hebrew, Farsi, Urdu):

```css
/* globals.css */
[dir='rtl'] {
  direction: rtl;
  text-align: right;
}

[dir='rtl'] .sidebar {
  border-right: none;
  border-left: 1px solid var(--border);
}

/* Mirror icons that have direction */
[dir='rtl'] .icon-arrow-right { transform: scaleX(-1); }
[dir='rtl'] .icon-chevron-right { transform: scaleX(-1); }
```

Set `dir` attribute on `<html>` based on locale:

```tsx
// Root layout
export default function Layout({ children }) {
  const { locale } = useTranslation();
  const isRTL = ['ar', 'fa', 'he', 'ur'].includes(locale);

  return (
    <html dir={isRTL ? 'rtl' : 'ltr'} lang={locale}>
      <body>{children}</body>
    </html>
  );
}
```

---

## REFERENCE FILES

```
OpenClaw:
  openclaw/ui/src/i18n/index.ts; i18n init
  openclaw/ui/src/i18n/lib/registry.ts; language registry
  openclaw/ui/src/i18n/lib/translate.ts; translate function
  openclaw/ui/src/i18n/locales/en.ts; English base
  openclaw/ui/src/i18n/locales/*.ts; 19 additional languages

Carina (existing i18n):
  src/i18n/index.ts; server-side i18n
  locales/; server-side locale files
```