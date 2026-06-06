# Platform Admin - Build Prompt

**Location:** `/opt/lampp/htdocs/VERLOX/Carina-ai/ops.carinaai.uk/`
**Purpose:** Personal admin panel for the VERLOX operator (you). Not a multi-user product. Not public. This is your own power interface to the Carina instance running on the VPS.
**Who uses it:** Only you, authenticated by a single admin password.

## What This Is Not

- Not the public Carina web UI at `app.carinaai.uk` (that is for end users)
- Not a multi-tenant admin (no user management needed)
- Not a separate application with its own database - it reads from the same Carina PostgreSQL database

## Stack

Plain Node.js + Express + EJS templates. No React, no build step, no bundler. Single `server.ts` file with route files. Tailwind via CDN in templates. Runs as a separate process on its own port (default 4000).

```
ops.carinaai.uk/
├── server.ts              Express app entry point
├── routes/
│   ├── auth.ts            Login/logout
│   ├── dashboard.ts       Overview stats
│   ├── memories.ts        Episodic memory browser
│   ├── skills.ts          Skill document manager
│   ├── rag.ts             RAG corpus viewer
│   ├── chat.ts            Direct Carina chat (connects to main agent)
│   └── projects.ts        VERLOX project tracker
├── views/                 EJS templates
│   ├── layout.ejs         Base layout with nav
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── memories/
│   │   ├── index.ejs      Memory list with search
│   │   └── view.ejs       Single memory detail
│   ├── skills/
│   │   ├── index.ejs      Skills list
│   │   ├── view.ejs       Skill detail + edit
│   │   └── new.ejs        Create skill manually
│   ├── rag.ejs            RAG chunks browser
│   ├── chat.ejs           Chat interface
│   └── projects.ejs       VERLOX project tracker
├── middleware/
│   └── auth.ts            Session check middleware
├── package.json
└── tsconfig.json
```

## Authentication

Single admin password stored in `.env` as `ADMIN_PASSWORD` (bcrypt-hashed or plain for local use). Session stored in server-side session (use `express-session` with a memory or Redis store). Session cookie is `HttpOnly`, `SameSite=Strict`.

Login page: email field is irrelevant - just a password field. On success, set `req.session.admin = true` and redirect to dashboard. Protect all routes with middleware that checks `req.session.admin`.

Do not use JWT for this - it is a simple session-based admin.

## Dashboard (`/`)

Stats from the Carina database:

| Stat | Query |
|---|---|
| Total memories | `SELECT COUNT(*) FROM episodic_memories` |
| Sessions (distinct) | `SELECT COUNT(DISTINCT session_id) FROM episodic_memories` |
| Skills saved | `SELECT COUNT(*) FROM skill_documents` |
| Most-used skill | `SELECT name, usage_count FROM skill_documents ORDER BY usage_count DESC LIMIT 1` |
| RAG chunks ingested | `SELECT COUNT(*) FROM rag_chunks` |
| Packs ingested | `SELECT DISTINCT pack FROM rag_chunks` |
| Inbound emails | `SELECT COUNT(*) FROM inbound_emails WHERE read = FALSE` |

Layout: 3-column stat cards at top, then two panels: "Recent sessions" (last 10 distinct session IDs with message count and last seen) and "Recently written skills" (last 5 by `created_at`).

## Memory Browser (`/memories`)

List view:
- Paginated table: 50 per page
- Columns: timestamp, session ID (clickable), role (badge: user/assistant), content preview (first 120 chars)
- Search bar: `WHERE content ILIKE '%query%'` with debounced AJAX or plain form submit
- Filter by role (all / user / assistant)
- Filter by session ID (text input)
- Delete button per row (soft delete is fine - just `DELETE FROM episodic_memories WHERE id = $1`)

Session view (`/memories/session/:sessionId`):
- Full conversation thread for that session
- Messages in chat-bubble layout (user right, assistant left)
- "Delete session" button deletes all rows for that session_id

Memory detail (`/memories/:id`):
- Full content
- Embedding dimensions (just show `embedding IS NOT NULL ? '1536-dim vector' : 'no embedding'`)
- Delete button

## Skill Manager (`/skills`)

List:
- Table: name, description, trigger keywords (chips), usage count, created at, actions
- "New skill" button

Skill detail / edit (`/skills/:id`):
- Editable form: name, description, trigger keywords (comma-separated text input), steps (textarea), tools used (checkboxes)
- Save button (`UPDATE skill_documents SET ... WHERE id = $1`)
- Delete button
- "Mark as used" button (increments `usage_count`)

Create skill (`/skills/new`):
- Same form as edit, blank
- `INSERT INTO skill_documents` on save

## RAG Corpus Viewer (`/rag`)

- Table: pack, source filename, first 150 chars of content, has embedding (yes/no)
- Group by pack (tabs or filter dropdown)
- Search by source filename
- No delete - corpus is read-only in the admin; re-run `pnpm ingest` to update
- "Re-ingest" button that POSTs to `/rag/ingest` which shell-execs `pnpm ingest` and streams stdout back to the browser using SSE

## Chat Interface (`/chat`)

A chat UI that connects directly to the main Carina agent via the SSE endpoint at `http://localhost:3000/api/chat/stream`. This is not a separate agent - it reuses the existing web gateway.

The admin chat differs from the public chat in:
- It shows the `[using tool-name...]` events visually as inline chips
- It shows token count and provider after each response
- It has a "System context" sidebar showing which skills and RAG chunks were used (if the API exposes this - if not, leave as a TODO)
- It has a VERLOX quick-actions panel on the right with buttons:
  - "Analyse BTL deal" - pre-fills message with the BRR analysis prompt
  - "Check HMO compliance" - pre-fills with HMO checklist prompt
  - "Yield calculator" - pre-fills with yield calc prompt
  - "Research area" - pre-fills with area scoring prompt
  - "Draft investor update" - pre-fills with update drafting prompt

## VERLOX Project Tracker (`/projects`)

A simple kanban-style tracker for VERLOX work. No separate database table needed for MVP - use a JSON file at `ops.carinaai.uk/data/projects.json`. Persist to file on every write.

Project structure:
```json
{
  "id": "uuid",
  "name": "Project name",
  "client": "Client name",
  "status": "active|paused|complete",
  "type": "BTL|HMO|BRR|Flip|Other",
  "address": "property address",
  "notes": "free text",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

Views:
- Kanban board: three columns (Active, Paused, Complete), drag-to-reorder within status using a simple JS drag implementation (no library)
- Add project form (modal or separate page)
- Click project card to expand notes and edit inline
- "Ask Carina" button per project: pre-fills the chat with `I'm working on [project.name] at [project.address], type [project.type]. [notes]` and opens the chat tab

## .env for ops.carinaai.uk

```
ADMIN_PASSWORD=changeme
SESSION_SECRET=generate-a-random-string
CARINA_DB_URL=postgresql://carina:secret@localhost:5433/carina_central
CARINA_API_URL=http://localhost:3000
PORT=4000
```

Note: `CARINA_DB_URL` connects directly to the Carina PostgreSQL database. Port 5433 because docker-compose.yml exposes it there. Adjust for production.

## package.json

```json
{
  "name": "carina-platform-admin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch server.ts",
    "start": "node dist/server.js",
    "build": "tsc"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "chalk": "^5.3.0",
    "dotenv": "^16.0.0",
    "ejs": "^3.1.10",
    "express": "^4.21.0",
    "express-session": "^1.18.0",
    "pg": "^8.12.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/ejs": "^3.1.5",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

Note: Use Express 4.x (not 5.x) for stability. The main app uses Express 5.x but ops.carinaai.uk is a separate install.

## Visual Design

Dark theme. Same colour palette as the Carina web UI (`src/gateway/web/index.html`):
- Background: `#0f0f0f`
- Card: `#1a1a1a`
- Border: `#2a2a2a`
- Text: `#e0e0e0`
- Green accent (Carina): `#22c55e`
- Cyan (user): `#06b6d4`

Navigation (left sidebar, collapsible):
- Logo: "Carina Admin" in bold white
- Links: Dashboard, Chat, Memories, Skills, RAG Corpus, Projects, Settings (placeholder)
- Bottom: "Carina v0.1.0" and a link to the main web UI

Tailwind CDN in layout.ejs for utility classes.

## Start Command

Add to root `package.json` scripts:
```json
"admin": "tsx ops.carinaai.uk/server.ts"
```

And to the root CLAUDE.md: admin panel runs at `http://localhost:4000`. Password in `ops.carinaai.uk/.env`.

## What NOT to Build

- No user management (single admin only)
- No email sending from admin panel
- No API key management (use .env directly)
- No deployment pipeline from admin panel
- No mobile-optimised layout (desktop only)
