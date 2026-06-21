# Research, compare, and writing workspace

Carina ships three workspace surfaces for deep work: **Deep Research**, **Model Compare**, and **Documents**. They share the same operator session and document store; no second document model is introduced.

## Deep Research

**Web:** `/research`  
**CLI:** `carina research "your question"`

Multi-step research: plan sub-questions, search the web, evaluate sources, synthesize with citations, and save the report under `~/.carina/research/`.

### Saved reports

Every completed run is persisted unless you pass `--no-persist` on the CLI. Reopen saved work from:

- **Web:** the **Saved research** list on `/research`, or a direct link `/research?open=<share-id>`
- **CLI:** `carina research list`, `carina research show <id-or-share-id>`, `carina research export <id>`

**API:**

- `GET /api/research/reports` - list saved report metadata
- `GET /api/research/reports/:id` - load markdown (id or share id)
- `GET /api/research/stream?q=...` - SSE progress stream; `done` event includes `saved` metadata
- `POST /api/research/run` - synchronous run

### Cite and continue

On the research page after a run:

- **Copy cite link** - shareable URL to reopen the report
- **Open in Documents** - import markdown into the writing editor
- **Continue research** - prefill a follow-up question from the current report

Messenger and CLI: `/research <query>` runs research in-channel; reports are saved the same way.

## Model Compare

**Web:** `/compare`  
**CLI:** `carina compare "prompt" [--blind] [--providers a,b,c]`

Runs the same prompt across configured providers in parallel. Blind mode hides provider names until you click **Reveal providers**.

On `/compare`:

1. Pick providers from the checkbox list (defaults to the first three configured).
2. Enter a prompt and submit.
3. Use **Open in Documents** to save the comparison as an editable markdown file.

**API:** `GET /api/compare/providers`, `GET /api/compare/stream`, `POST /api/compare/run`

## Documents (writing workspace)

**Web:** `/documents`

Markdown-first editor with live preview, auto-save, export, and **AI Assist** (selection or full document).

Import paths:

- From research: **Open in Documents** on `/research`, or `/documents?fromResearch=<share-id>`
- From compare: **Open in Documents** after a compare run
- Direct open: `/documents?open=<document-id>`

Documents use the existing `documents-api` SQLite store per tenant. Research reports stay in the research index; importing creates a copy in Documents so you can edit without altering the original report.

## Workspace hub

Open `/workspace` for cards linking to research, compare, documents, notes, and other surfaces. Featured cards: Research, Compare, Playbook.

## Related

- [Getting started](./getting-started.md)
- [Messaging gateway](./messaging-gateway.md) (`/research`, `/compare` in messengers)
- [Providers matrix](./providers-streaming-matrix.md)
