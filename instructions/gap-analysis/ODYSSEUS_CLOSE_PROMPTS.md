# Carina vs Odysseus: Gap-Close Prompts

**Date:** 2026-06-15
**Source analysis:** ODYSSEUS_ANALYSIS.md, ODYSSEUS_2026-06-15.md, GAP_ANALYSIS.md, extracted_planned_features.md
**Codebase root:** `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk`

## Context

Odysseus hit 70K GitHub stars in 14 days and is the most-watched self-hosted AI workspace right now.
It is NOT a direct competitor to Carina. Odysseus targets end-users who want a private ChatGPT.
Carina targets builders who want a commercial-grade agent platform. But several Odysseus features are now
table-stakes for any serious AI workspace. This document closes those specific gaps without changing
Carina's core positioning.

Carina advantages to preserve and surface: MIT license (AGPL vs MIT is the commercial story), Scout
security layer, domain packs, multi-tenancy, channel breadth, npm install, hosted mode.

Odysseus features Carina is missing: Cookbook (model discovery + serving), Deep Research as a named
feature, Model Compare, Document Editor, Notes/Tasks integration, Image Gallery.

---

## Rules for all prompts

- Read every file listed in "Files to inspect first" before writing a single line.
- Do not add model calls or network round-trips to the live chat hot path.
- Do not remove or rename any existing public API, CLI command, or config key.
- Every new file needs a matching `*.test.ts` unless the prompt says otherwise.
- Emit `declare(strict_types=1)` on PHP files. Use TypeScript strict mode on TS files.
- Never use em dashes. Never use emojis. Plain ASCII only.
- Write no comments unless the WHY is not obvious from the code.
- Preserve Carina speed. All new features are opt-in or behind a CLI subcommand.

---

## O1: carina cookbook (model discovery and local serving)

### Why

The single biggest UX gap between Carina and Odysseus is model discovery. Odysseus scans your GPU,
estimates VRAM, and says "here are the 5 models that run on your machine - click to download and
serve." Carina connects to APIs. Most people who want self-hosted AI don't know which model fits
their hardware. Cookbook removes that barrier.

This is P0. It is Odysseus's headline differentiator. It does not touch the live chat path.

### What to build

**1. Hardware profiler** (`src/cookbook/hardware.ts`)

Detect and report:
- GPU vendor, model, VRAM (via `nvidia-smi`, `rocm-smi`, `system_profiler` on macOS, WMI on Windows)
- CPU cores and RAM (via `os` module)
- Available disk space for model downloads
- OS platform
- Return a typed `HardwareProfile` object
- Cache result in memory for the session; do not re-probe on every call
- Never throw; return partial data with a `warnings: string[]` field when detection fails

**2. Model catalog** (`src/cookbook/catalog.ts`)

A static, versioned catalog of models with hardware requirements. Do not call any network on import.
Each entry:
```ts
interface CatalogEntry {
  id: string; // e.g. "llama-3.1-8b-q4"
  displayName: string;
  family: string; // e.g. "llama", "mistral", "phi", "gemma", "qwen"
  paramCount: string; // e.g. "8B", "70B"
  quantization: string; // e.g. "Q4_K_M", "Q8_0", "FP16", "AWQ"
  format: 'gguf' | 'safetensors' | 'awq' | 'fp8';
  vramRequiredGb: number;
  ramRequiredGb: number;
  diskGb: number;
  downloadUrl: string; // HuggingFace or direct link
  serveVia: ('ollama' | 'llama.cpp' | 'vllm' | 'lm-studio')[];
  strengths: string[]; // e.g. ["coding", "instruction", "reasoning"]
  license: string; // e.g. "MIT", "Meta Llama 3.1 Community License"
  contextWindow: number;
}
```

Include at minimum 40 models covering: small (1-4B, runs on CPU/4GB VRAM), medium (7-13B, needs 8GB
VRAM), large (30-70B, needs 24GB+), and reasoning (DeepSeek-R1 variants). Include quantized GGUF
variants of every family for llama.cpp compatibility.

**3. Model recommender** (`src/cookbook/recommender.ts`)

Given a `HardwareProfile` and the catalog, return:
```ts
interface Recommendation {
  tier: 'cpu-only' | 'low-vram' | 'mid-vram' | 'high-vram';
  recommended: CatalogEntry[]; // top 5, sorted by capability within fit
  marginal: CatalogEntry[]; // fit if RAM is swapped or quantization is lower
  excluded: { entry: CatalogEntry; reason: string }[];
}
```

Filter logic:
- `vramRequiredGb <= detected VRAM * 0.85` (leave headroom for OS)
- If no GPU: `ramRequiredGb <= detected RAM * 0.7` and `format === 'gguf'`
- Sort within tier: context window descending, then strengths breadth

**4. Serve helper** (`src/cookbook/serve.ts`)

Given a `CatalogEntry`, emit shell commands to:
- Download the model (Ollama: `ollama pull {id}`, llama.cpp: `wget {downloadUrl}`)
- Serve the model (Ollama: `ollama run {id}`, llama.cpp: `./server -m {file} --port 8080`)
- Wire it to Carina as a local provider (print the `.env` keys to set)

Do not execute commands automatically. Print them. Let the user run them. Add a
`--execute` flag to `carina cookbook serve` that runs with explicit confirmation.

**5. CLI commands** (`src/cli/commands/cookbook-cli.ts`)

```
carina cookbook                  # show hardware profile + top 5 recommendations
carina cookbook list             # full catalog, filtered to what runs on this machine
carina cookbook list --all       # full catalog including what does not fit
carina cookbook search <query>   # filter by family/strength/size
carina cookbook inspect <id>     # detailed entry: specs, requirements, download URL, serve commands
carina cookbook serve <id>       # print serve commands (--execute to run with confirm)
carina cookbook serve <id> --via ollama|llama.cpp|vllm
```

Output format for `carina cookbook` (no flags):
```
Hardware: NVIDIA RTX 3080 10GB VRAM | 32GB RAM | 240GB free
Tier: mid-vram

Recommended models (fit on your hardware):
  llama-3.1-8b-q4        8B  Q4_K_M  GGUF   5.1 GB   coding, instruction
  mistral-7b-q5          7B  Q5_K_M  GGUF   5.4 GB   instruction, reasoning
  phi-4-q4               14B Q4_K_M  GGUF   8.9 GB   coding, math, reasoning
  deepseek-r1-7b-q4      7B  Q4_K_M  GGUF   4.8 GB   reasoning
  gemma-2-9b-q4          9B  Q4_K_M  GGUF   6.4 GB   instruction, multilingual

Run `carina cookbook serve llama-3.1-8b-q4 --via ollama` to get serve commands.
Run `carina cookbook list --all` to see all 40+ models.
```

**6. Tests** (`src/cookbook/cookbook.test.ts`)

- hardware profiler returns a valid profile on current machine (no throw)
- recommender returns 0 recommendations for 0GB VRAM and 4GB RAM (cpu-only tier)
- recommender returns only GGUF format for cpu-only tier
- recommender respects VRAM headroom (0.85 factor)
- catalog has no duplicate IDs
- catalog entries all have valid `serveVia` arrays
- CLI `cookbook` command does not call any model API

### Files to inspect first

- `src/brain/provider-registry.ts` - understand provider ID conventions
- `src/brain/llm.ts` - understand how local providers (Ollama, llama.cpp) are wired
- `src/cli/commands/` - match existing CLI command style
- `src/config/` - understand config key patterns for local endpoints

### Acceptance criteria

- `carina cookbook` runs on a machine with no GPU and returns cpu-only recommendations
- `carina cookbook` runs on a machine with an NVIDIA/AMD GPU and returns appropriate tier
- `carina cookbook serve <id>` prints correct Ollama and llama.cpp commands without executing
- `carina cookbook serve <id> --execute` prompts "Run these commands? (yes/no)" before acting
- No model API is called during any cookbook command
- All tests pass

---

## O2: Deep Research as a named, structured feature

### Why

Odysseus markets "Deep Research" as a first-class named feature: multi-step research runs that gather
sources, read them, and synthesize cited reports. Carina has a `ResearchAgent` that is 14 lines.
The capability exists in the underlying tools (web-search, http-request) but is not packaged as a
usable feature. Naming and packaging it closes the gap.

This is P0. Deep Research is demonstrable, shareable output. It does not require new tools.

### What to build

**1. Deep Research executor** (`src/agents/deep-research.ts`)

Expand beyond the 14-line stub into a proper research orchestrator:

```ts
export interface DeepResearchOptions {
  query: string;
  maxRounds: number; // default 4; each round = plan + search + read + synthesize step
  maxSources: number; // default 12; cap total sources fetched
  outputFormat: 'markdown' | 'html';
  saveToFile?: string; // if set, write report here; else stream to stdout
  providerOverride?: ProviderOverride;
}

export interface DeepResearchReport {
  title: string;
  summary: string; // 2-3 sentence executive summary
  sections: ResearchSection[];
  sources: SourceCitation[];
  searchQueries: string[]; // all queries issued
  roundCount: number;
  generatedAt: string; // ISO timestamp
}

export interface ResearchSection {
  heading: string;
  body: string;
  sourceCitations: string[]; // source IDs referenced in this section
}

export interface SourceCitation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  fetchedAt: string;
}
```

Execution plan:
1. Round 0 - Planning: ask the model (no tools) to generate 3-5 specific sub-questions that must be
   answered to cover the topic. Store as `researchPlan`.
2. Rounds 1..N - Search and read: for each sub-question, issue a web-search, fetch the top 3
   result pages via http-request, extract text, store as source with citation metadata.
   Cap at `maxSources` total.
3. Final round - Synthesis: provide all extracted source text and the research plan to the model.
   Ask it to write a structured report with headings, citations using the source IDs, and a
   summary. Parse into `DeepResearchReport`.

Do not use a single giant prompt. Use the existing SubAgent / tool-runner infrastructure.
The ResearchAgent allowed tools (`web-search`, `http-request`, `file-read`) are correct.

Stream progress to stdout: "Planning...", "Searching: {query}", "Reading: {url}", "Synthesising...".
Stream is separate from the final report so piping `carina research ... > report.md` still works.

**2. CLI command** (`src/cli/commands/research-cli.ts`)

```
carina research "<query>"
carina research "<query>" --rounds 6
carina research "<query>" --sources 20
carina research "<query>" --save report.md
carina research "<query>" --format html --save report.html
carina research "<query>" --provider groq  # use a specific provider for this run
```

Output when no `--save`:
- Stream progress lines to stderr
- Write the final markdown report to stdout
- Exit code 0 on success, 1 on error

When `--save`:
- Stream progress to stdout
- Write report to the file
- Print "Report saved to report.md" on completion

**3. In-session `/research` command** (`src/gateway/commands.ts`)

Add `/research <query>` as a gateway slash command. It runs the same executor, sends the summary
back to the chat session, and posts the full report as a file attachment if the channel supports
attachments. If the channel is plain text (Telegram, SMS), send summary + truncated sources list.

**4. Tests** (`src/agents/deep-research.test.ts`)

Mock `web-search` and `http-request` tools. Test:
- planning round returns at least 3 sub-questions
- synthesis produces a report with all required fields
- `maxSources` cap is respected
- `saveToFile` writes valid markdown
- `/research` gateway command returns a non-empty summary

### Files to inspect first

- `src/agents/research-agent.ts` - existing 14-line stub to expand
- `src/agents/sub-agent.ts` - SubAgent base class
- `src/agents/tool-runner.ts` - how tools are invoked
- `src/gateway/commands.ts` - how slash commands are registered
- `src/tools/web-search.ts` and `src/tools/http-request.ts` - tool contracts

### Acceptance criteria

- `carina research "UK stamp duty changes 2026"` returns a structured markdown report with
  at least 3 headings and at least 5 source citations, on any machine with a configured provider
- Report includes an executive summary, section headings, and a sources list
- `--save report.md` writes a parseable markdown file
- Progress lines stream in real time; the report itself is produced only at the end
- `/research` in a chat session returns the summary within one message
- All tests pass

---

## O3: Model Compare

### Why

Odysseus's Compare feature lets you send one prompt to multiple models simultaneously and see
responses side-by-side with an optional blind mode. It is simple, high-delight, and uniquely
demonstrates why having a multi-provider runtime matters. Carina already has multiple providers
wired. Compare is just a thin orchestration layer on top.

This is P1. Carina already has the infrastructure; Compare just needs to exist as a named feature.

### What to build

**1. Compare executor** (`src/agents/compare.ts`)

```ts
export interface CompareOptions {
  prompt: string;
  providers: string[]; // provider IDs to query, e.g. ['anthropic', 'groq', 'deepseek']
  blind: boolean; // if true, show results without provider labels until revealed
  maxTokens?: number; // default 800; keep responses comparable length
  systemPrompt?: string;
  outputFormat: 'terminal' | 'markdown';
}

export interface CompareResult {
  prompt: string;
  responses: {
    providerId: string;
    model: string;
    response: string;
    latencyMs: number;
    tokenCount?: number;
  }[];
  generatedAt: string;
}
```

Fan-out: call all providers in parallel using `Promise.allSettled`. Do not wait for one before
starting the next. Capture latency per provider. Mark failed providers with error text instead of
a response; do not abort the whole comparison for one provider failure.

**2. CLI command** (`src/cli/commands/compare-cli.ts`)

```
carina compare "<prompt>"
carina compare "<prompt>" --providers anthropic,groq,deepseek
carina compare "<prompt>" --blind
carina compare "<prompt>" --save compare-output.md
carina compare "<prompt>" --providers anthropic,groq --max-tokens 500
```

Terminal output (non-blind):
```
Prompt: "Explain compound interest in one paragraph."

anthropic (claude-sonnet-4-6)  | 1.2s | 143 tokens
-----------------------------------------------------
Compound interest is...

groq (llama-3.3-70b)           | 0.4s | 128 tokens
-----------------------------------------------------
When interest is...

deepseek (deepseek-v4-flash)   | 0.8s | 156 tokens
-----------------------------------------------------
Compound interest works...
```

Blind output: Show "Provider A", "Provider B", "Provider C" labels. After all responses are shown,
print "Press Enter to reveal providers." and wait. Then reprint labels with real provider IDs.

**3. In-session `/compare` command** (`src/gateway/commands.ts`)

Add `/compare <prompt>` as a gateway slash command. If the channel supports formatted output
(Discord, Telegram), use provider name as a section heading. For plain channels, number them.

**4. Tests** (`src/agents/compare.test.ts`)

Mock provider calls. Test:
- fan-out calls all providers in parallel (measure via spy call timing)
- one provider failure does not abort results from others
- blind mode returns labelled results without provider IDs in the label text
- latency field is populated for every result

### Files to inspect first

- `src/brain/llm.ts` - `routeRequest` or equivalent that makes a single provider call
- `src/brain/provider-registry.ts` - provider IDs and aliases
- `src/gateway/commands.ts` - slash command registration pattern
- `src/cli/commands/` - match existing CLI style

### Acceptance criteria

- `carina compare "What is 2+2?" --providers anthropic,groq` calls both providers in parallel
  and shows both responses without waiting for the slower one to finish first
- If one provider is unconfigured, it shows an error for that slot; others succeed
- `--blind` hides provider names and reveals them after Enter
- `/compare` in a chat session returns both responses in one message
- All tests pass

---

## O4: Document Editor surface in web UI

### Why

Odysseus has a multi-tab document editor (markdown, HTML, CSV) with AI assist. The philosophy is
"you write, the AI assists" rather than the AI generating everything. This is a distinct workspace
mode from chat. Carina has no document editing surface in the web UI today.

This is P1. It does not require backend changes to the agent runtime. It is purely a web UI feature
that talks to existing Carina endpoints.

### What to build

**1. Document store API** (`src/gateway/documents-api.ts` and `src/gateway/router.ts`)

Simple REST endpoints:
```
POST   /api/documents            { title, content, format }   -> { id, ... }
GET    /api/documents            -> [{ id, title, format, updatedAt }]
GET    /api/documents/:id        -> { id, title, content, format, updatedAt }
PUT    /api/documents/:id        { title?, content? }         -> { id, ... }
DELETE /api/documents/:id        -> 204
POST   /api/documents/:id/ai-assist  { instruction, selection? } -> { result }
```

Store documents in the existing SQLite or Postgres database under a `carina_documents` table.
The `ai-assist` endpoint takes the full document content and an instruction (e.g. "Improve this
paragraph's clarity"), calls Carina's LLM router with a focused system prompt, and returns the
suggested replacement text. Do NOT replace automatically; return the suggestion only.

Table schema (add as a migration in `src/infrastructure/migrations/`):
```sql
CREATE TABLE carina_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'markdown',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**2. Web UI page** (`src/gateway/web/documents.html` and `src/gateway/web/documents.js`)

Single-page document editor. No external JS dependencies beyond what the rest of the Carina web UI
already uses.

Features:
- Sidebar: document list with title, format badge, last-modified. "+ New" button.
- Editor: `<textarea>` with monospace font, tab-key inserts two spaces, auto-save on 2-second idle.
- Toolbar: format selector (Markdown / HTML / CSV / Plain), word count, "Save" button, "Export" button.
- AI Assist panel (collapsible): text field for instruction, "Apply to selection" / "Apply to full
  document" buttons. Shows AI suggestion in a diff-style preview. User can "Accept" or "Discard".
- Markdown preview pane (toggle): render markdown to HTML in a split pane. Use a simple regex-based
  renderer or a minimal existing library already in the Carina web bundle - do not add a new npm
  dependency.

The AI Assist panel calls `POST /api/documents/:id/ai-assist`. It never auto-applies; the user
accepts explicitly.

**3. Navigation** (`src/gateway/web/`)

Add "Documents" to the Carina web UI sidebar / nav bar. It should appear between "Chat" and
"Memory" (or wherever the nav currently places secondary tools).

**4. Tests** (`src/gateway/documents-api.test.ts`)

- create returns 201 with an id
- list returns empty array before any create
- get returns 404 for unknown id
- update changes content and bumps updated_at
- delete returns 204 and subsequent get returns 404
- ai-assist endpoint returns a non-empty string suggestion

### Files to inspect first

- `src/gateway/router.ts` - how routes are registered
- `src/gateway/web/` - existing HTML pages to match style
- `src/infrastructure/migrations/` - migration pattern for new tables
- `src/brain/llm.ts` - how to make a focused LLM call for the assist endpoint
- `src/gateway/web-auth.ts` - authentication middleware for new routes

### Acceptance criteria

- Opening `/documents` in the web UI shows a document list and "+ New" button
- Creating a document, typing in it, and waiting 2 seconds auto-saves without user action
- The AI Assist panel sends a suggestion without modifying the document until the user clicks Accept
- Markdown preview renders headings, bold, italic, lists, and code blocks correctly
- Export downloads the document as a `.md`, `.html`, or `.csv` file depending on format
- All API tests pass

---

## O5: Notes and Tasks surface

### Why

Odysseus has an integrated notes and tasks surface with reminders and cron-style scheduled delivery.
Carina has a `cronjob` tool and a `todo` tool but they are agent tools inside conversations, not
a user-facing surface. The gap is visibility: users cannot see or manage their tasks without asking
the agent.

This is P1. It is additive and does not change the agent runtime.

### What to build

**1. Notes and Tasks API** (`src/gateway/notes-api.ts`)

```
POST   /api/notes              { title, body, format }      -> { id, ... }
GET    /api/notes              ?format=note|task|reminder   -> [...]
GET    /api/notes/:id          -> { id, title, body, format, done, remindAt, ... }
PUT    /api/notes/:id          { title?, body?, done?, remindAt? }  -> { id, ... }
DELETE /api/notes/:id          -> 204
```

`format` is `'note' | 'task' | 'reminder'`. Tasks have a `done` boolean. Reminders have a
`remindAt` ISO timestamp.

Table:
```sql
CREATE TABLE carina_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'note',
  done INTEGER NOT NULL DEFAULT 0,
  remind_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**2. Reminder delivery** (`src/agents/reminder-delivery.ts`)

A lightweight scheduler that checks `carina_notes` for rows where `remind_at <= now() AND done = 0`
and sends them via the appropriate channel. Wire into the existing cron scheduler infrastructure
(`src/agents/cron-scheduler.ts`). Run every minute. For each due reminder:
- Create a Carina chat message: "Reminder: {title} - {body}"
- Mark `done = 1` after delivery
- Deliver to the default session or a configured delivery target

**3. Agent tools integration**

When the agent uses the `todo` or `cronjob` tool to create a task or reminder, also write a row
to `carina_notes`. This makes agent-created tasks visible in the notes surface without the user
having to ask the agent.

Do this in the tool implementation, not in the agent loop. Keep the tool-runner hot path clean.

**4. Web UI page** (`src/gateway/web/notes.html`)

Three-pane layout:
- Left: filter tabs (All / Notes / Tasks / Reminders)
- Center: list of items, sorted by updated_at descending. Tasks show a checkbox. Reminders show
  a clock icon with the due time.
- Right: editor pane (same as documents editor: auto-save, AI Assist panel, format toggle).

Tasks: clicking the checkbox marks `done = true` via `PUT /api/notes/:id`. Completed tasks move
to a "Done" section at the bottom (collapsed by default).

Reminders: show "Due in X minutes" or "Overdue by X hours" relative to current time, refreshed
every 30 seconds via `setInterval`.

**5. Tests** (`src/gateway/notes-api.test.ts` and `src/agents/reminder-delivery.test.ts`)

- CRUD operations for all three formats
- `done` toggle updates correctly
- reminder delivery sends the right message for overdue rows
- reminder delivery does not re-send already-done rows

### Files to inspect first

- `src/agents/cron-scheduler.ts` - how periodic jobs are scheduled
- `src/tools/todo.ts` - existing todo tool to hook into
- `src/tools/cronjob.ts` - existing cronjob tool
- `src/gateway/router.ts` - route registration
- `src/gateway/web/documents.html` - use same UI pattern as documents editor

### Acceptance criteria

- Opening `/notes` shows three tabs and an empty list on a fresh install
- Creating a note, task, and reminder each work via the web UI
- Checking a task checkbox marks it done immediately (optimistic UI update)
- A reminder with `remindAt` set to 2 minutes from now delivers a chat message after 2 minutes
- Tasks created by the agent's `todo` tool appear in the notes surface automatically
- All tests pass

---

## O6: Image Gallery surface

### Why

Odysseus has an image gallery: generate, view, inpaint, and remove backgrounds. Carina has image
generation as a tool but no gallery or editing surface. The tool output is ephemeral. A gallery
makes generated images persistent and shareable.

This is P2. It does not change the agent runtime. It requires only a storage layer and a web UI.

### What to build

**1. Image store API** (`src/gateway/images-api.ts`)

```
GET    /api/images             ?page=1&limit=24            -> [{ id, prompt, url, ... }]
GET    /api/images/:id         -> { id, prompt, url, model, width, height, createdAt }
DELETE /api/images/:id         -> 204
POST   /api/images/generate    { prompt, model?, width?, height? } -> { id, url, ... }
POST   /api/images/:id/inpaint { mask, prompt }            -> { id, url }
POST   /api/images/:id/remove-background                   -> { id, url }
```

Store image metadata in a `carina_images` table. Store image binary data either:
- On disk under `data/images/` (default, simplest)
- Or in the configured object store if one is wired

Table:
```sql
CREATE TABLE carina_images (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT,
  width INTEGER,
  height INTEGER,
  filepath TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

The `generate` endpoint calls the existing image generation tool/provider (OpenAI `dall-e-3`,
Stability AI, or whatever is configured). Save the result to disk and return the stored record.

The `inpaint` endpoint calls the provider's inpaint API if available. If not available, return 422
with `{ error: "Inpaint not supported by configured provider" }`.

The `remove-background` endpoint calls a background-removal API if configured (e.g. remove.bg).
If not configured, return 422 with `{ error: "Background removal API not configured" }`.

**2. Web UI page** (`src/gateway/web/images.html`)

Masonry grid layout of generated images. Each thumbnail:
- Shows the image
- On hover: shows the prompt (truncated), a "Copy prompt" button, a "Delete" button
- On click: opens a lightbox with full image, prompt, model, size, date, and action buttons:
  "Inpaint", "Remove background", "Download", "Use as prompt"

Generation panel (right sidebar or floating bottom bar):
- Prompt input
- Model selector (dall-e-3, sd-xl, flux, or whatever providers are configured)
- Width/height presets: Square (1024x1024), Portrait (768x1344), Landscape (1344x768)
- "Generate" button

Pagination: load 24 at a time, "Load more" at the bottom.

**3. Agent tool integration**

When the `image-generation` tool produces an image, also write a row to `carina_images`. This
makes agent-generated images appear in the gallery automatically without user action.

**4. Tests** (`src/gateway/images-api.test.ts`)

Mock the image provider. Test:
- generate returns 201 with an id and url
- list returns paginated results
- delete removes the record and the file
- inpaint returns 422 when no provider is configured for it
- agent tool integration: tool call writes to carina_images

### Files to inspect first

- `src/tools/image-generation.ts` (or wherever image generation is implemented)
- `src/gateway/router.ts`
- `src/gateway/web/` - existing pages for style reference
- `src/infrastructure/migrations/`
- `src/config/` - how optional provider configs are checked

### Acceptance criteria

- Opening `/images` shows the masonry grid (empty on fresh install)
- "Generate" with a prompt calls the configured image provider and displays the result in the grid
- Clicking an image opens the lightbox with the full prompt and action buttons
- Images generated by the agent during chat appear in the gallery automatically
- Delete removes both the DB record and the file from disk
- All tests pass

---

## O7: Node host daemon and device pairing (self-hosted story)

### Why

Odysseus's strongest selling point is "runs on your own hardware." The Cookbook (O1) gets models
onto the hardware. The node host daemon completes the story: Carina runs as a background service
on the user's machine, survives reboots, and accepts connections from paired devices (phone, tablet,
second machine). This is the piece that makes Carina feel like "your own private AI" rather than
"a CLI you have to keep running."

The gap analysis shows this is entirely not built (`src/host/` does not exist). It is P1 from the
gap100.md analysis and closes a gap that Odysseus exploits heavily in its marketing.

This is P1. It does not touch the live agent loop.

### What to build

**1. Node host daemon** (`src/host/daemon.ts`)

A wrapper around the existing Carina gateway that:
- Installs itself as an OS service (systemd on Linux, launchd on macOS, Windows Task Scheduler
  on Windows)
- Manages start/stop/restart/status/uninstall lifecycle
- Writes a PID file to `~/.carina/daemon.pid`
- Writes a daemon log to `~/.carina/daemon.log` (rotate at 10MB)
- On start: launches the gateway on the configured port (default 7430) and keeps it alive
- On crash: restarts with exponential backoff (1s, 2s, 4s, 8s, cap 60s)

Use the Node.js `child_process` module to spawn the gateway. Do not embed a C daemon.

**2. CLI commands** (`src/cli/commands/host-cli.ts`)

The `host-cli.ts` file already exists. Expand it to:
```
carina host install    # install as OS service; print status
carina host start      # start the daemon (if installed); print PID and URL
carina host stop       # stop the daemon; wait for clean shutdown
carina host restart    # stop + start
carina host status     # show running/stopped, PID, uptime, last error
carina host uninstall  # remove OS service; leave data intact
carina host logs       # tail daemon.log
carina host logs --follow
```

Each command must detect whether the correct OS service manager is available (systemd, launchctl,
schtasks) and fall back gracefully if not.

**3. Device pairing** (`src/pairing/pairing.ts`)

Generate a time-limited pairing token (32-byte random hex, valid for 5 minutes).
When a device presents the token to `POST /api/pair/accept`, store it as a named device:
```sql
CREATE TABLE carina_paired_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  last_seen TEXT,
  created_at TEXT NOT NULL
);
```

CLI:
```
carina pair          # generate a pairing token and QR code, wait for pairing
carina pair list     # list paired devices
carina pair revoke <id>
```

QR code: encode `carina://pair?token=<hex>&host=<local-ip>&port=7430` as a QR code printed to
the terminal using Unicode block characters (no external library needed; implement a minimal
10x10 QR-code renderer or use a pure-JS library already in the bundle).

API endpoints (add to `src/gateway/router.ts`):
```
POST /api/pair/accept    { token, deviceName } -> { deviceId, status: 'paired' }
GET  /api/pair/devices   (auth required)       -> [{ id, name, lastSeen }]
DELETE /api/pair/devices/:id (auth required)   -> 204
```

**4. Tests** (`src/host/daemon.test.ts`, `src/pairing/pairing.test.ts`)

- daemon detects current OS correctly
- daemon generates valid systemd unit file on Linux
- daemon generates valid plist on macOS
- pairing token expires after 5 minutes
- revoked token is rejected on second use
- paired device list returns correct records

### Files to inspect first

- `src/cli/commands/host-cli.ts` - existing stub to expand
- `src/gateway/router.ts` - route registration for pairing API
- `src/config/` - where `CARINA_PORT` or gateway port is configured
- `src/cli/commands/` - CLI command style

### Acceptance criteria

- `carina host install` writes a service file and prints "Installed. Run `carina host start` to start."
- `carina host start` starts the daemon, writes a PID file, and prints the local URL
- `carina host status` shows "running" with uptime when the daemon is live
- `carina host stop` shuts down cleanly within 5 seconds
- `carina pair` prints a QR code in the terminal and waits
- A second device that presents the pairing token gets a `deviceId` back
- `carina pair revoke <id>` removes the device and rejects further connections from it
- All tests pass

---

## O8: MIT vs AGPL advantage - make it impossible to miss

### Why

The most important structural advantage Carina has over Odysseus is commercial. Odysseus is AGPL-3.0.
Anyone who builds a product on Odysseus must open-source their entire codebase. Carina is MIT.
Builders can keep their domain logic private. This distinction does not appear prominently enough
in Carina's CLI, docs, or gateway web UI. It should be the first thing a builder sees.

This is P1. It requires no backend changes. It is documentation and UI copy.

### What to build

**1. CLI `carina about` command** (`src/cli/commands/status-cli.ts` or new file)

```
carina about
```

Output:
```
Carina Agent Runtime v{version}
License: MIT (https://opensource.org/licenses/MIT)
Build commercial products on Carina. Keep your domain logic private.
AGPL-3.0 alternatives (Odysseus, etc.) require you to open-source everything you build on them.

Carina does not.

Docs:     https://core.carinaai.uk/docs/
Hosted:   https://app.carinaai.uk/
Scout:    https://console.labyrinthscout.com/
GitHub:   https://github.com/carinaai/core
```

**2. Gateway web UI header** (`src/gateway/web/`)

Add a one-line footer on every web UI page:
```
Carina v{version} | MIT License | Build commercial products freely
```

Link "MIT License" to the LICENSE file in the GitHub repo.

**3. Update `src/gateway/web/index.html` or the root landing page**

If there is a root index page served by the gateway, add a visible "Why Carina vs Odysseus/Hermes"
section that states:
- MIT license: build and sell products without open-sourcing them
- Scout security layer: injection shield, kill switch, audit log, egress filtering
- Multi-tenancy and hosted mode: not just a single-user workspace
- Domain packs: vertical skill sets for specific industries
- Channel breadth: 18+ adapters vs web-only

Keep it factual. No superlatives. No emojis.

**4. `docs/MIT-vs-AGPL.md`** in the kernel docs directory

Write a clear, factual comparison explaining:
- What AGPL-3.0 requires (copyleft extends to the entire combined work, including your proprietary
  application code, if it is distributed or provided as a service)
- What MIT allows (use, copy, modify, distribute, sublicense, sell, even in proprietary products)
- Practical impact: if you build a SaaS on Odysseus, you must open-source your SaaS codebase
- Practical impact: if you build a SaaS on Carina, you own your codebase

No legal advice disclaimer is needed. State facts only.

### Files to inspect first

- `src/cli/commands/status-cli.ts` - existing status/about command if one exists
- `src/gateway/web/` - find the root index or layout file
- `core.carinaai.uk/docs/` - docs directory for the new comparison file

### Acceptance criteria

- `carina about` or `carina --version` shows the MIT license statement
- Every web UI page has the MIT footer line
- `docs/MIT-vs-AGPL.md` exists and correctly states the license implications
- No factually incorrect claims about other projects

---

## Implementation order

| Prompt | Feature | Priority | Effort estimate |
|--------|---------|----------|----------------|
| O1 | carina cookbook | P0 | 2 days |
| O2 | Deep Research | P0 | 1 day |
| O3 | Model Compare | P1 | 0.5 day |
| O8 | MIT vs AGPL copy | P1 | 0.5 day |
| O4 | Document Editor | P1 | 2 days |
| O5 | Notes and Tasks | P1 | 1.5 days |
| O7 | Node host daemon | P1 | 2 days |
| O6 | Image Gallery | P2 | 1.5 days |

Start with O1 and O2. They are the features most people see in the Odysseus video. Once they exist,
Carina can be mentioned in the same breath as Odysseus in community discussions.

O3 and O8 are half-day jobs. Do them immediately after O1 and O2.

O4, O5, O7 build the workspace layer. Do them in parallel if multiple engineers are available.

O6 is last because image generation provider support varies by operator configuration.

---

## What NOT to build

Do not build:
- Themes / customizable UI skins. Not a platform-level concern.
- CalDAV calendar sync. Not core to the agent story. Mention it in the notes surface as a future
  integration.
- A generic all-in-one workspace UI that competes with Odysseus on its own terms. Carina is the
  platform. Odysseus is the workspace. They are not the same product.
- AGPL-licensed code from Odysseus. Do not copy any code from the Odysseus repository.

---

## Tracking

After implementing each prompt, update `GAP_ANALYSIS.md` Section C with status markers.
After O1-O3 are live, update `ODYSSEUS_2026-06-15.md` comparison table with new statuses.
