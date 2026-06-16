# Prompt 11 - Search and AI Defaults Settings

## Objective

Add Odysseus-depth **Search** and **AI Defaults** settings to Carina Cloud: web search provider, results per query, default chat/utility/research models, email safety toggle.

---

## Context

**Working directory:** `app.carinaai.uk`

**Odysseus reference:** Search Settings (Tavily, fallback chain), AI Defaults (chat model, utility model, vision, research, image gen, email safety).

---

## Step 1 - Schema

Extend `workspace_settings`:

```ts
webSearchEnabled: boolean().default(true),
webSearchProvider: text().default('tavily'), // tavily | duckduckgo | brave
webSearchMaxResults: integer().default(5),
tavilyApiKeyEncrypted: text(), // optional BYOK for Tavily

defaultChatProvider: text(),
defaultChatModel: text(),
utilityProvider: text(),
utilityModel: text(),
researchProvider: text(),
researchModel: text(),
emailSafetyMode: boolean().default(true), // true = draft only, never auto-send
```

---

## Step 2 - Settings pages

`/settings/ai` - AI Defaults:
- Dropdowns populated from configured BYOK providers + model lists (reuse ModelSelector data source).
- Separate rows: Chat, Utility (background tasks), Research.
- Email safety: "Stage drafts only (recommended)" toggle.

`/settings/search` - Search:
- Enable web search default for new sessions
- Provider select
- Max results
- Tavily API key (optional, encrypted)

Link from main settings index.

---

## Step 3 - Wire to runtime

- `ChatInputBar` web search default from `webSearchEnabled`.
- `carina-chat.ts` uses `defaultChatProvider/Model` when user has not overridden in session.
- Research jobs use `researchProvider/Model` from settings.
- Email send endpoint blocks when `emailSafetyMode` true without explicit `confirmSend: true` in body.

---

## Acceptance criteria

- [ ] Settings persist and load on workspace layout init (ThemeProvider pattern).
- [ ] Chat uses default model when session has no override.
- [ ] Email send requires extra confirm when safety mode on.
