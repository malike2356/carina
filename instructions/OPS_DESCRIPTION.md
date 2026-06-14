# Carina Ops; Complete Description

**Last updated:** 13 June 2026
**Status:** LIVE
**Live at:** ops.carinaai.uk (port 4002)
**Auth:** Session-based admin login (ADMIN_PASSWORD in .env)
**Repository:** carina-ai/ops.carinaai.uk

---

## What Carina Ops Is

Carina Ops is the platform administration dashboard for Carina; the operations panel where you manage every aspect of the Carina agent platform. It is:

- The single control surface for managing Carina's SaaS tenants, subscriptions, billing, skill packs, memory, RAG corpus, security posture, and AI platform configuration
- The pairing bridge between Carina Core (agent engine) and Labyrinth Scout (security); Ops connects them both
- The operator's console; live security event streaming, agent kill/resume controls, alert channel configuration
- The hosted mode admin; provision tenants, manage plans, track usage, handle BYOK providers
- The internal chat interface; a streaming chat UI to talk directly to the Carina agent from the admin panel

Ops is NOT a customer-facing product. It is the admin panel for Laud (the operator) to manage the Carina platform.

---

## Architecture

### Technology Stack

- Runtime: Node.js with TypeScript (compiled via tsc, run with tsx in dev)
- Server: Express, EJS templates for server-rendered HTML
- Port: 4002 (production) / 4000 (development)
- Auth: Session-based with ADMIN_PASSWORD (from .env)
- Database: PostgreSQL (shared with Carina Core via CARINA_DB_URL)
- Views: EJS templating with auto-layout wrapping

### Repository Structure

```
ops.carinaai.uk/
├── server.ts                    # Express entry point (146 lines)
├── ops-bridge.mjs               # Legacy reverse proxy
├── start.sh                     # Start script
├── .env                         # Admin password, DB URLs, Scout URL, Carina URL
├── package.json
├── tsconfig.json
│
├── routes/                      # 14 route modules
│   ├── auth.ts                  # Login/logout (session-based)
│   ├── dashboard.ts             # Main dashboard (stats, recent sessions/skills)
│   ├── ai-platform.ts           # AI Platform sub-app (agents, analytics, batches, etc.)
│   ├── tenants.ts               # Tenant CRUD, provisioning, impersonation, BYOK (444 lines)
│   ├── subscriptions.ts         # Subscription management
│   ├── security.ts              # Scout integration (live SSE, kill/resume, events)
│   ├── settings.ts              # Platform settings, pairing, passwords, alert channels
│   ├── chat.ts                  # Streaming chat with Carina agent
│   ├── skills.ts                # Skill CRUD
│   ├── packs.ts                 # Skill pack enable/disable
│   ├── memories.ts              # Episodic memory browser
│   ├── rag.ts                   # RAG corpus browser + re-ingest
│   ├── projects.ts              # VERLOX project board
│   └── operator.ts              # Operator-level controls
│
├── lib/                         # Business logic (16 modules)
│   ├── db.ts                    # Database connection (PostgreSQL)
│   ├── tenants.ts               # Tenant queries, hosted schema
│   ├── tenant-provisioning.ts   # Tenant creation, access control, subs management
│   ├── tenant-audit.ts          # Audit log for tenant operations
│   ├── tenant-packs.ts          # Per-tenant skill pack configuration
│   ├── tenant-byok.ts           # BYOK provider key management
│   ├── carina.ts                # Carina Core API client (via ops token)
│   ├── carina-pairing.ts        # Auto-pairing from local core .env
│   ├── scout.ts                 # Scout API client (via Scout key)
│   ├── billing-plans.ts         # Plan definitions (free, pro, enterprise)
│   ├── packs.ts                 # Skill pack definitions
│   ├── projects.ts              # Project board data
│   ├── hosted-migrations.ts     # Hosted schema migrations
│   ├── support-impersonation.ts # Tenant impersonation for support
│   ├── ai-platform.ts           # AI platform schema + queries
│   └── core-env.ts              # Core environment reading
│
├── middleware/
│   └── auth.ts                  # requireAdmin middleware
│
├── views/                       # 35+ EJS templates
│   ├── layout.ejs               # Sidebar + scaffold (wraps all pages)
│   ├── login.ejs                # Login form
│   ├── error.ejs                # Error page
│   ├── dashboard.ejs            # Main dashboard (stats grid, recent sessions, skills)
│   ├── security.ejs             # Scout security tab (296 lines, SSE + kill modal)
│   ├── chat.ejs                 # Streaming chat UI (217 lines)
│   ├── settings.ejs             # Platform settings (537 lines)
│   ├── tenants.ejs              # Tenant list with filters
│   ├── tenant-create.ejs        # New tenant form
│   ├── tenant-detail.ejs        # Tenant detail with 8 tabs (473 lines)
│   ├── subscriptions.ejs        # Subscription management
│   ├── projects.ejs             # Kanban project board (drag-and-drop)
│   ├── rag.ejs                  # RAG corpus browser
│   ├── skills/                  # Skill management (index, new, view, _form)
│   ├── packs/index.ejs          # Skill pack toggle UI with audit trail
│   ├── memories/                # Memory browser (index, session, view)
│   ├── ai-platform/             # AI Platform sub-pages (13 views)
│   └── partials/                # Shared partials (nav, tabs)
│
├── public/
│   ├── styles.css
│   └── favicon.svg
│
├── data/
│   └── projects.json            # Project board persistence
│
└── types/
    └── session.d.ts
```

### Production Deployment

```
Contabo VPS (80.190.81.208)
└── /home/malike/apps/ops.carinaai.uk/
    ├── dist/                    # Compiled TypeScript
    ├── views/                   # EJS templates
    ├── public/                  # Static assets
    ├── .env                     # Admin password + config
    └── node_modules/

Supervisor: carina-ops (port 4002)
Access: ops.carinaai.uk (nginx reverse proxy)
Auth: Session-based (ADMIN_PASSWORD from .env)
```

---

## Navigation & Layout

The entire Ops panel uses a two-column layout:

### Sidebar (fixed, 224px width, dark #1a1a1a background)

Navigation links with active-state highlighting (green text + dark background):

| Route | Label | Purpose |
|-------|-------|---------|
| `/` | Dashboard | Platform statistics overview |
| `/ai-platform` | AI Platform | Model economics, credits, agents, deployments |
| `/tenants` | Tenants | Hosted tenant provisioning and management |
| `/subscriptions` | Subscriptions | Subscription billing state across all tenants |
| `/security` | Security | Live Scout event stream, kill/resume controls |
| `/chat` | Chat | Streaming chat with Carina agent |
| `/memories` | Memories | Episodic memory browser with search/filter |
| `/skills` | Skills | Skill management (list, create, edit) |
| `/packs` | Skill Packs | Enable/disable skill packs with audit trail |
| `/rag` | RAG Corpus | RAG chunk browser with re-ingest |
| `/projects` | Projects | Kanban project board for VERLOX work |
| `/settings` | Settings | Pairing, passwords, alert channels, environment |

**Sidebar footer:**
- Carina version: v0.1.0
- Scout status indicator (green dot = live, red = offline); auto-checked via fetch to /security/events
- Link to Main Web UI (opens core.carinaai.uk in new tab)
- Logout button

### Main Content Area (flex-1, dark #0f0f0f background)

All pages are wrapped in the layout scaffold. Each page sets its own `<title>` (prefixed "Page Title · Carina Admin").

---

## Page-by-Page Description

### 1. Dashboard (`/`)

The landing page after login. Five sections:

**Hosted Tenants Summary** (conditionally shown if hosted schema is ready):
- Total tenants, Free/Pro counts, Messages today, Tokens this month
- Link to full tenant dashboard

**Stats Grid** (6 cards, responsive grid):
| Card | Shows |
|------|-------|
| Total memories | Count from episodic_memories table |
| Sessions | Distinct session count |
| Skills saved | Count from skill_documents table |
| Most-used skill | Name + usage count (green) |
| RAG chunks | Count + active pack names |
| Unread emails | Count from inbound_emails |

**Recent Sessions**; List of last 10 sessions with truncated session IDs (linked to /memories/session/:id) and message counts

**Recently Written Skills**; List of last 5 created skills with dates (linked to /skills/:id)

---

### 2. AI Platform (`/ai-platform`)

A comprehensive sub-application for managing Carina's AI operations. Has its own sub-navigation bar (overview, agents, sessions, deployments, vaults, memory, files, environments, skills, analytics, credits, batches, workbench).

#### AI Platform Overview Page

**Credits & Spend Grid** (4 cards):
- Credit balance ($) with monthly limit
- Spend this month ($)
- Prompt caching: Enabled/Disabled
- Batch API: Enabled/Disabled

**Count Grid** (6 clickable cards linking to sub-pages):
- Agents, Sessions, Deployments, Vault items, Memory stores, Files

**Usage (30 days)**; Requests, Tokens in, Tokens out, Cache hits, Batch jobs, Estimated cost

**Org Settings**; Organization name, Auto-reload status, Edit credits link

**Models Table**; All configured models with provider, model name, tier, status, input price per 1M tokens, and output price per 1M tokens. Default model flagged in green.

**Recent Workbench Runs**; List of recent prompt test runs with status and cost estimate.

#### Sub-pages (13 total)

Each sub-page is a focused view for managing that aspect of the AI platform:
- Agents; Agent configuration and lifecycle
- Sessions; Active and historical session browser
- Deployments; Deployment management
- Vaults; Credential and secret management
- Memory; Memory store configuration
- Files; Asset and file management
- Environments; Environment configuration
- Skills; Platform-level skill management
- Analytics; Usage analytics and dashboards
- Credits; Credit balance, monthly limits, auto-reload
- Batches; Batch job submission and tracking
- Workbench; Interactive model prompt testing

---

### 3. Tenants (`/tenants`)

The SaaS tenant management hub. Two states:

**Not initialized**; If hosted schema doesn't exist:
- Amber banner explaining the hosted_users table is missing
- "Initialize hosted schema" button (POST /tenants/init-schema)

**Initialized**; Full tenant management:

**Summary Grid** (7 cards): Total, Manual/direct, SaaS, Suspended, Free tier, Pro tier, Tokens (month)

**Filter Bar**: All / Manual/direct / SaaS / Suspended / Free / Pro

**Tenant Table** with columns: Name/email, Status (active/suspended + tier badge), Provisioning type, Plan (free/pro), Usage (msgs today + tokens/mo), Packs count, Updated date, Manage link

**Create Tenant** button; opens form with display name, email, optional password, plan selection, provisioning type

#### Tenant Detail Page (`/tenants/:id`)

**Header:** Back link, tenant name, email, UUID, tier/status/provisioning badges

**Credentials banner** (shown once after creation): Temporary password and API key in code blocks

**8 Tabs:**
| Tab | Purpose |
|-----|---------|
| Overview | Account details (display name, company, API key, schema, dates, plan, provider count), Quick usage (messages today, tokens, packs) |
| Subscription | Plan selection (free/pro/enterprise), Stripe integration status, subscription lifecycle |
| Payments | Payment history |
| Usage | Token consumption, message counts, daily limits |
| Packs | Per-tenant skill pack enable/disable checkboxes |
| Access | Access status (active/suspended), suspend/restore controls |
| BYOK | Bring-Your-Own-Key provider management (add/remove/toggle provider API keys) |
| Audit | Immutable audit log of all tenant operations (provisioning, tier changes, access changes, pack changes) |

**Support impersonation**; Button to start a read-only impersonation session (15-minute duration). Displays red banner when active. All write operations blocked during impersonation. End session button to terminate.

---

### 4. Subscriptions (`/subscriptions`)

Filterable table of all tenant subscription records:

**Filters:** All / Manual/direct / SaaS / Active / Suspended

**Table columns:** Tenant (name + email), Plan, Billing state (active/inactive), Source (manual/SaaS), Access (active/suspended), Renewal (Stripe ID + period end, or "Manual"), Manage link

---

### 5. Security (`/security`)

Live Scout integration tab. Two modes:

**Scout Offline:**
- Amber banner: "Labyrinth Scout is not running at <SCOUT_URL>. Start it with: cd console.labyrinthscout.com && pnpm dev"
- All stat cards show "-"
- No live stream

**Scout Online:**

**Stat Cards** (4): Critical (red), Warning (amber), Info (cyan), Breach (red); all 24h counts

**Live Event Stream** (left 2/3):
- Filter buttons: All, Critical, Warning, Info, Breach
- Monospace event rows with timestamps, severity badges, event types, descriptions (truncated to 80 chars), instance IDs
- New events appear at bottom with green flash animation
- Auto-scroll to bottom
- Connected via SSE (Server-Sent Events); proxies Scout's SSE stream
- SSE connection indicator (green/red dot + label)
- Auto-reconnect with exponential backoff (2s to 30s max)

**Agent Instances Panel** (right 1/3):
- Per-instance cards showing: name, UUID, status badge (active=green, suspended=red, offline=grey)
- Last heartbeat with live countdown (updates every 5 seconds)
- KILL button (active instances); opens confirmation modal with reason textarea
- RESUME button (suspended instances); immediate resume
- Error messages displayed inline on failure

**Kill Modal:** Overlay with target instance name, reason textarea, Cancel/Confirm kill buttons. On confirm, POSTs to /security/kill/:instanceId.

---

### 6. Chat (`/chat`)

Full-featured streaming chat with the Carina agent:

**Layout:** Chat panel (left, flex-1) + Sidebar (right, 288px)

**Chat Panel:**
- Provider badge in header bar (shows active provider or "offline")
- Clear session button
- Message area with user/assistant bubbles (user=cyan, assistant=dark with border)
- Input textarea with auto-grow (max 120px height)
- Send button (green, disabled during streaming)
- Enter sends, Shift+Enter for newline
- Server-Sent Events for streaming responses
- Markdown rendering (via marked.js CDN) applied after stream completes
- Estimated token count displayed after response
- Session persistence via localStorage (UUID)

**Sidebar:**
- VERLOX Quick Actions; Pre-loaded prompt buttons for common tasks. Click populates the input with the prompt text for editing before sending.
- Session Info; Current session ID (first 8 chars), provider info, estimated tokens

**Auto-detection:** If Carina is offline, an amber banner appears and input is disabled. Tests connection on first send.

---

### 7. Memories (`/memories`)

Searchable browser for the episodic_memories table:

**Filters:**
- Full-text search input
- Role dropdown (All/User/Assistant)
- Session ID text filter
- Filter button

**Table:** Sortable by Time, Session, Role. Shows:
- Timestamp (sortable)
- Session ID (8-char truncated, linked to session view)
- Role badge (user=user, assistant=assistant, colour-coded)
- Content preview (truncated)
- Link to full view

**Session view** (`/memories/session/:id`): Full conversation thread for a single session

**Single memory view** (`/memories/view/:id`): Full detail of one memory entry

---

### 8. Skills (`/skills`)

**Index:** Table of all skills with columns: Name (linked to detail), Description (truncated), Trigger keywords (tag chips, max 4 shown), Usage count, Updated date, Edit link

**New Skill:** Form with name, description, trigger keywords, full markdown content

**View/Edit:** Full skill editor; name, description, trigger keywords, SKILL.md content textarea, save button

Shared _form.ejs partial for consistent create/edit forms.

---

### 9. Skill Packs (`/packs`)

Enable or disable Carina skill packs for Core. Saved to the persistent operator store; no .env edit required.

**Shows:**
- Link to "Open core /packs" (carinaApiUrl/packs)
- Error banner if Carina not paired
- Success banner after save
- "Last update" timestamp with actor and source
- Pack Table: Checkboxes for each available pack, with pack name, category, version, description, and skill count
- Save button: "Save active packs" with note: "Uncheck all for general-purpose mode"
- Recent Changes audit trail; Before/after pack lists with timestamps, actor, and source
- Recent Skill Eval Runs; Offline evaluation results with pass rates, pack names, and timestamps

---

### 10. RAG Corpus (`/rag`)

Browser for the rag_chunks table:

**Controls:**
- Pack filter dropdown (all packs or specific pack)
- Search input (searches source field)
- Filter button
- Re-ingest button; Triggers SSE-based re-ingestion with live log output in a pre element

**Table:** Time, Pack (green label), Source (monospace, truncated), Preview (first 150 chars), Embedding status (yes/no)

**Pagination:** "Page X of Y (Z chunks). Read-only; use Re-ingest to refresh."

---

### 11. Projects (`/projects`)

Kanban board for VERLOX project tracking:

**Three columns:** Active | Paused | Complete

**Project cards:** Draggable between columns. Each shows:
- Project name (bold)
- Client - type
- Address (truncated)
- Expandable Notes section with inline save
- "Ask Carina" link; opens Chat tab with pre-filled prompt about the project
- Delete button with confirmation

**Drag and drop:** HTML5 draggable cards. Dropping on a column updates the status via fetch POST.

**Add Project modal:** Form with name (required), client, type (dropdown), status (dropdown), address, notes

**Data persistence:** Stored in data/projects.json

---

### 12. Settings (`/settings`)

The most feature-rich page (537 lines). Three-column layout on XL screens, stacked on mobile.

**Status banners** (conditional):
- Default password warning (if ADMIN_PASSWORD is still "changeme")
- Scout password updated confirmation
- Carina auto-pair success / error
- Carina manual pair success / error
- Scout pair success / error
- Core web password updated / error
- Ops admin password updated / error

**Left Column; Connections:**

**Carina Agent panel:**
- Connection status (Connected / Token saved, not connected / Not paired)
- API URL display
- Test connection button (POST /settings/test-carina); shows service name or error

**Labyrinth Scout panel:**
- Scout URL display
- Test connection button (POST /settings/test-scout)

**Connect to Carina agent:**
- Auto-connect button (reads CARINA_OPS_TOKEN from core .env on same server)
- Shows source path from core .env
- Manual fallback: password input for CARINA_OPS_TOKEN, Save button

**Connect to Labyrinth Scout:**
- Pairing status indicator
- Scout API key input (lscout_...), Pair with Scout button

**Alert Channels section:**
- Dashboard URL input with Save button
- Three channel configuration panels (side by side):
  - Telegram: Bot token (password, masked placeholder), Chat ID, Min severity dropdown (info/warning/critical/breach), Enabled checkbox, Save Telegram button
  - Email (Resend): Resend API key (masked), To address, From address, Min severity, Enabled, Save email button
  - Slack: Webhook URL (masked), Min severity, Enabled, Save Slack button
- Test Alert: Severity selector + Send test alert button; sends to all configured channels, shows result with channel count and event ID

**Right Column; Passwords:**

**Core web login password:**
- Status: set / not set
- New password + Confirm password inputs
- Update button (min 8 chars, requires Carina connection)

**Ops admin password:**
- New password + Confirm password
- Update button

**Scout console password:**
- New password + Confirm password
- Update button

**Environment (read-only):**
- PORT, CARINA_API_URL, SCOUT_URL
- ADMIN_PASSWORD status (set/default)
- CARINA_OPS_TOKEN status (set/not set)
- SCOUT_API_KEY status (set/not set)
- SKILL_AUTO_WRITE (true/false)

---

## Key Libraries

| Library | Purpose |
|---------|---------|
| lib/carina.ts | Carina Core API client; uses CARINA_OPS_TOKEN for authenticated requests |
| lib/carina-pairing.ts | Auto-pairing; reads CARINA_OPS_TOKEN from core.carinaai.uk/.env |
| lib/scout.ts | Scout API client; uses SCOUT_API_KEY for authenticated requests, proxies SSE streams |
| lib/tenants.ts | Tenant queries, hosted schema management, display name formatting, provisioning labels |
| lib/tenant-provisioning.ts | Tenant creation (direct and SaaS), access control, subscription management, password generation |
| lib/tenant-audit.ts | Immutable audit logging for all tenant operations |
| lib/tenant-packs.ts | Per-tenant skill pack configuration |
| lib/tenant-byok.ts | BYOK provider key add/remove/toggle |
| lib/billing-plans.ts | Plan definitions (free with 10K tokens, pro with 500K, enterprise custom) |
| lib/packs.ts | Skill pack metadata and selection parsing |
| lib/support-impersonation.ts | Read-only tenant impersonation (15-min sessions) |
| lib/ai-platform.ts | AI platform schema and queries |
| lib/core-env.ts | Reads core.carinaai.uk/.env for auto-pairing |
| lib/db.ts | PostgreSQL connection pool |
| lib/hosted-migrations.ts | Schema migrations for hosted_users table |

---

## API Routes Summary

All routes require admin session authentication (except auth routes).

| Route | Method | Purpose |
|-------|--------|---------|
| /login | GET/POST | Login form and authentication |
| /logout | POST | End session |
| / | GET | Dashboard with stats |
| /ai-platform | GET | AI Platform overview |
| /ai-platform/* | GET | 12 sub-pages (agents, analytics, batches, etc.) |
| /tenants | GET/POST | List tenants, create tenant |
| /tenants/init-schema | POST | Initialize hosted schema |
| /tenants/new | GET | New tenant form |
| /tenants/:id | GET | Tenant detail (8 tabs via ?tab=) |
| /tenants/:id | POST | Update tenant (tier, access, plan, packs, notes) |
| /tenants/:id/byok | POST | Add/remove/toggle BYOK provider key |
| /tenants/:id/impersonation | POST | Start impersonation |
| /tenants/impersonation/end | POST | End impersonation |
| /subscriptions | GET | Subscription management |
| /security | GET | Scout security tab (SSE, kill/resume) |
| /security/events | GET | Scout event proxy |
| /security/stream | GET | SSE stream proxy |
| /security/kill/:id | POST | Kill agent instance |
| /security/resume/:id | POST | Resume agent instance |
| /chat | GET | Chat UI |
| /chat/provider | POST | Get active provider |
| /chat/stream | GET | SSE streaming chat |
| /memories | GET | Memory browser with search/filter |
| /memories/session/:id | GET | Session memory view |
| /memories/view/:id | GET | Single memory detail |
| /skills | GET/POST | Skill list, create |
| /skills/new | GET | New skill form |
| /skills/:id | GET/POST | Skill detail/edit |
| /packs | GET/POST | Skill pack toggle with audit |
| /rag | GET | RAG corpus browser |
| /rag/ingest | GET | SSE-based re-ingestion |
| /projects | GET/POST | Project board, create project |
| /projects/:id | POST | Update project |
| /projects/:id/delete | POST | Delete project |
| /settings | GET | Settings page |
| /settings/carina-auto-pair | POST | Auto-pair Carina from local .env |
| /settings/carina-pairing | POST | Manual Carina pairing |
| /settings/scout-pairing | POST | Scout pairing |
| /settings/test-carina | POST | Test Carina connection |
| /settings/test-scout | POST | Test Scout connection |
| /settings/carina-web-password | POST | Update core web login password |
| /settings/ops-admin-password | POST | Update ops admin password |
| /settings/scout-password | POST | Update Scout console password |
| /settings/alert-channels | GET | List alert channels |
| /settings/alert-channels/:type | PUT | Update alert channel config |
| /settings/alert-channels-platform | PUT | Update dashboard URL |
| /settings/alert-test | POST | Send test alert |

---

## Database

Carina Ops shares a PostgreSQL database with Carina Core (via CARINA_DB_URL). Key tables:

| Table | Used For |
|-------|----------|
| episodic_memories | Memory browser, session views, dashboard stats |
| skill_documents | Skills management, dashboard stats, usage counts |
| rag_chunks | RAG corpus browser |
| inbound_emails | Unread email count on dashboard |
| hosted_users | Tenant management (created by ensureHostedSchema) |
| hosted_user_providers | BYOK provider keys |
| hosted_user_packs | Per-tenant skill pack assignments |
| hosted_audit_log | Tenant operation audit trail |
| ai_platform_* | AI Platform resources |

---

## Startup Sequence

When the server starts (server.ts main function):

1. Load .env from ops root directory
2. Set up Express with:
   - Static file serving from public/
   - EJS view engine with auto-layout wrapping (every render goes through layout.ejs except login page)
   - Session middleware (24h expiry, strict sameSite, secure in production)
   - Admin auth middleware on all routes except /login
3. Mount all 14 route modules
4. Ensure hosted schema exists (ensureHostedSchema)
5. Ensure AI platform schema exists (ensureAiPlatformSchema)
6. Attempt auto-pair with Carina from local core .env (autoPairCarinaFromLocalCore)
7. Listen on configured port (4002 production, 4000 dev)
8. Log startup message with admin password hint

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| ADMIN_PASSWORD | Ops login password (default: changeme) |
| SESSION_SECRET | Session encryption secret |
| CARINA_DB_URL | PostgreSQL connection (shared with Carina Core) |
| CARINA_API_URL | Carina Core API URL (default: http://localhost:3333) |
| CARINA_OPS_TOKEN | Token for authenticating with Carina Core (set via pairing) |
| SCOUT_URL | Scout server URL (default: http://localhost:4444) |
| SCOUT_API_KEY | Scout API key (set via pairing, format: lscout_...) |
| PORT / OPS_PORT | Server port (default: 4002 prod / 4000 dev) |
| NODE_ENV | Environment (production/development) |
| SKILL_AUTO_WRITE | Enable automatic skill writing by agent |

---

## Current Status

| Component | Status |
|-----------|--------|
| Ops Server | LIVE (port 4002, supervisor: carina-ops) |
| Login | LIVE (session-based, ADMIN_PASSWORD) |
| Dashboard | LIVE (stats, recent sessions, recent skills) |
| AI Platform | LIVE (13 sub-pages) |
| Tenants | LIVE (CRUD, 8 tabs, impersonation, BYOK) |
| Subscriptions | LIVE (filterable table) |
| Security Tab | LIVE (SSE stream, kill/resume) |
| Chat Tab | LIVE (streaming, quick actions, markdown) |
| Memories | LIVE (search, filter, session view) |
| Skills | LIVE (CRUD) |
| Skill Packs | LIVE (toggle, audit trail, eval reports) |
| RAG Corpus | LIVE (browse, re-ingest) |
| Projects | LIVE (kanban, drag-and-drop) |
| Settings | LIVE (pairing, 3 passwords, alert channels, environment) |
| Carina Pairing | LIVE (auto from local .env + manual) |
| Scout Pairing | LIVE (manual API key) |

---

## Key URLs

| URL | Purpose |
|-----|---------|
| https://ops.carinaai.uk | Ops admin panel (login) |
| https://ops.carinaai.uk/security | Live Scout security feed |
| https://ops.carinaai.uk/chat | Streaming chat with Carina |
| https://ops.carinaai.uk/tenants | Tenant management |
| https://ops.carinaai.uk/settings | Platform configuration |
| https://core.carinaai.uk | Carina agent engine (linked as "Main web UI") |
| https://console.labyrinthscout.com | Labyrinth Scout console |
