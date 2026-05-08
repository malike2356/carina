# Carina AI — Public Docs, Accessibility & Future Platforms

---

## Part 1: Public Documentation Site

### What

A public-facing documentation site at `https://docs.carina.verlox.uk` (or `/docs` on the main app).

### Pages

| Path | Content | Auto-generated? |
|---|---|---|
| `/` | Home, getting started, search | — |
| `/quickstart` | Sign up, first API call, first chat | — |
| `/api` | Full API reference | ✅ From OpenAPI spec |
| `/api/authentication` | API keys, rate limits, scopes, errors | ✅ |
| `/guides/chat` | Using the chat, streaming, context | — |
| `/guides/area-reports` | Generating area intelligence reports | — |
| `/guides/deal-analysis` | Analysing deals with Carina | — |
| `/guides/training` | Uploading documents, training Carina | — |
| `/guides/billing` | Plans, tokens, top-ups, BYOK | — |
| `/changelog` | Release notes | — |
| `/security` | Security overview | — |
| `/status` | System status | ✅ Real-time |
| `/faq` | Frequently asked questions | — |
| `/python` | Python SDK reference | ✅ From docstrings |
| `/javascript` | JavaScript SDK reference | ✅ From JSDoc |

### Implementation

```yaml
# mkdocs.yml (or similar static site generator)
site_name: Carina AI Docs
theme: material
repo_url: https://github.com/verlox/carina
edit_uri: edit/main/docs/

nav:
  - Home: index.md
  - Quickstart: quickstart.md
  - API Reference:
    - Overview: api/index.md
    - Authentication: api/authentication.md
    - Chat: api/chat.md
    - Knowledge: api/knowledge.md
    - Analysis: api/analysis.md
    - Billing: api/billing.md
  - Guides:
    - Chat with Carina: guides/chat.md
    - Area Reports: guides/area-reports.md
    - Deal Analysis: guides/deal-analysis.md
  - SDKs:
    - Python: sdks/python.md
    - JavaScript: sdks/javascript.md
  - Billing: billing.md
  - Changelog: changelog.md
  - Security: security.md
  - FAQ: faq.md
```

### Auto-Generating API Docs

```bash
# Generate OpenAPI spec from Laravel routes (spatie/laravel-openapi)
php artisan openapi:generate --output=docs/openapi.json

# Build static site from markdown
mkdocs build --output-dir=public/docs
```

### Files

```
docs/                           # Markdown source for docs site
├── index.md
├── quickstart.md
├── api/
├── guides/
├── sdks/
├── billing.md
├── changelog.md
├── security.md
├── faq.md
└── mkdocs.yml

public/docs/                    # Built static site (auto-generated)

.github/workflows/
└── docs.yml                    # Rebuild on push to docs/
```

---

## Part 2: Accessibility & Compliance

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|---|---|
| Colour contrast | Tailwind v4 design tokens meet WCAG AA ratios. Test with Contrast Checker. |
| Keyboard navigation | All interactive elements reachable via Tab. Visible focus indicators. |
| Screen reader support | ARIA labels on dynamic content. `role="status"` on chat responses. `aria-live="polite"` on streaming text. |
| Text resizing | All text in `rem` units. No hardcoded pixel sizes. Layout works at 200% zoom. |
| Alt text | All generated images include alt text from the prompt. |
| Error identification | Form errors listed before the field. Colour + icon + text. |
| Focus order | Logical tab order: input → send → conversation → suggestions. |
| Skip navigation | "Skip to content" link at top of every page. |
| Reduced motion | `prefers-reduced-motion` disables animations. |

### UK Equality Act 2010

- Reasonable adjustments for disabled users
- Alternative formats for reports (HTML + text, not only PDF)
- Support response within 48 hours for accessibility requests

### Cookie Consent (UK PECR)

```
┌──────────────────────────────────────────────────┐
│  🍪 This site uses cookies for authentication    │
│  and billing. No tracking cookies.               │
│  [Accept] [Manage Preferences]                   │
└──────────────────────────────────────────────────┘
```

---

## Part 3: Future Platforms

### API Playground (Swagger/OpenAPI)

```
/api/docs

┌──────────────────────────────────────────┐
│  POST /api/v1/chat                       │
│  ┌──────────────────────────────────────┐│
│  │ Authorization: Bearer ca_live_...    ││
│  │ {                                    ││
│  │   "message": "What's the yield?"     ││
│  │ }                                    ││
│  └──────────────────────────────────────┘│
│  [Try it] [Copy as cURL] [Python] [JS]  │
│                                          │
│  Response: 200                           │
│  { "reply": "...", "tokens_used": 245 }  │
└──────────────────────────────────────────┘
```

**Implementation:** `spatie/laravel-openapi` or `darkaonline/l5-swagger`.

### Desktop App (Phase 3)

| Platform | Approach |
|---|---|
| **macOS** | SwiftUI menu bar app. Chat, quick screenshot → analysis. |
| **Windows** | Tauri app. System tray. Same functionality. |
| **Linux** | Tauri app (already cross-platform). |

### Browser Extension (Phase 3)

- Chrome + Firefox extension
- Right-click any property listing → "Analyse with Carina"
- Read property page content → send to Carina for analysis
- Popup window for quick questions

### SDK Libraries (Phase 2)

| Language | Package | Covers |
|---|---|---|
| **Python** | `pip install carina-ai` | All API endpoints, streaming, webhook verification |
| **JavaScript** | `npm install carina-ai` | Same + React hooks |
| **PHP** | `composer require verlox/carina-ai` | Same + Laravel service provider |

### Status Page

```
https://status.carina.verlox.uk
(hosted on BetterStack free tier, or self-hosted with Uptime Kuma)

Carina AI             ● Operational     Last 90 days: 99.97% uptime
  └ Chat API          ● Operational
  └ Knowledge API     ● Operational
  └ AI Providers      ● 3/3 available
  └ Data Integrations ● 4/4 available
```
