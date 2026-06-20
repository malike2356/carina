# Prompt 05: i18n System with 20 Languages

## Context

Carina targets global operators. The web UI at `app.carinaai.uk` is English-only.
The i18n system uses `react-i18next` with JSON translation files. Translation files for 20
languages must be generated using the Carina agent itself (translate strings via the LLM
router), then reviewed for accuracy.

## Target Languages

| Code | Language | Code | Language |
|------|----------|------|----------|
| en | English (base) | fr | French |
| es | Spanish | de | German |
| pt | Portuguese | nl | Dutch |
| it | Italian | pl | Polish |
| ru | Russian | tr | Turkish |
| ar | Arabic (RTL) | hi | Hindi |
| ja | Japanese | zh-CN | Chinese (Simplified) |
| zh-TW | Chinese (Traditional) | ko | Korean |
| sv | Swedish | no | Norwegian |
| da | Danish | fi | Finnish |

## What to Build

### 1. i18next setup

```bash
pnpm add react-i18next i18next i18next-http-backend i18next-browser-languagedetector
```

Create `apps/cloud/src/i18n.ts`:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en','fr','es','de','pt','nl','it','pl','ru','tr','ar','hi','ja','zh-CN','zh-TW','ko','sv','no','da','fi'],
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    interpolation: { escapeValue: false },
  });

export default i18n;
```

### 2. Translation string extraction

Extract all UI strings into `apps/cloud/public/locales/en/translation.json`.
Key sections to extract:
- Navigation labels (Chat, Memory, Projects, Settings, Billing, Scout)
- Action buttons (Send, Save, Cancel, Delete, Confirm, Copy)
- Status labels (Connected, Disconnected, Loading, Error)
- Chat UI (placeholder, thinking, tool-running states)
- Settings page labels
- Error messages from `src/lib/chat-errors.ts`

### 3. Translation generation script

Create `scripts/translate-i18n.ts`:
```typescript
// Uses Carina's LLM router to translate the English strings to all 19 other languages.
// Run: pnpm tsx scripts/translate-i18n.ts
// Output: apps/cloud/public/locales/{lang}/translation.json for each language.
```

The script reads `en/translation.json`, iterates all 19 other languages, sends batches of
50 strings to the LLM with a translation prompt, writes the result. Takes ~10 minutes for
all 20 languages.

### 4. RTL support for Arabic

In the root `<html>` element, add `dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}`.
The CSS already uses CSS logical properties (margin-inline-start etc.) from Tailwind v4;
no additional RTL stylesheet needed.

### 5. Language switcher

Add a language selector dropdown in Settings → General:
```
Language: [English] [dropdown]
```

The selected language is saved to localStorage and to the user's profile in the DB
(`user_preferences.language`). On next login, Carina loads the user's preferred language.

## Verification Checklist

- [ ] Change language to French - all nav labels and buttons show in French
- [ ] Switch to Arabic - layout flips to RTL, text is right-aligned
- [ ] Unknown language code falls back to English without error
- [ ] All 20 `public/locales/{lang}/translation.json` files exist and are valid JSON
- [ ] Language preference persists across page reload

## Files to Create or Modify

- CREATE `apps/cloud/src/i18n.ts`
- CREATE `apps/cloud/public/locales/en/translation.json`
- CREATE `apps/cloud/public/locales/*/translation.json` (19 other languages)
- CREATE `scripts/translate-i18n.ts`
- MODIFY `apps/cloud/src/main.tsx` - import i18n module
- MODIFY `apps/cloud/src/pages/SettingsPage.tsx` - add language switcher
- MODIFY `apps/cloud/src/components/*.tsx` - replace hard-coded strings with `t()` calls
