# Odysseus Gap Analysis: What Makes Our WebUI and Ops Fall Short

Date: 2026-06-15
Screenshots studied: 58 (full Odysseus feature tour)

---

## What Odysseus Is

Odysseus is a self-hosted AI chat platform (open source, runs on localhost:7000). It uses a floating panel system where every tool opens as a windowed overlay on top of the main chat. The design language is dark charcoal (#1c1c1c base) with a coral-pink accent colour, monospaced text in chat, and obsessive attention to information density without clutter.

---

## What Odysseus Has That We Do Not

### 1. Chat Quality - the biggest gap

Odysseus chat messages show:
- Token count and generation time on every assistant message (`31 tok - 1.63s`)
- Per-message actions: copy, delete, pin (bookmark icon), more (`...`)
- Tool call display inline, collapsible: shows tool name, input, and output
- Streaming indicator (live dot)
- Typed conversation header with message count dropdown (`A Simple Hello Message - 4 msgs`)

Carina's chat (`app.carinaai.uk`) is a basic textarea + green Send button. No metadata, no per-message controls, no tool call visibility. Users cannot see what the agent is doing.

### 2. Session Library

Odysseus Library has four tabs: Chats, Documents, Research, Archive.
- Every chat session is stored, searchable, can be expanded with preview inline
- Actions per session: Delete, Archive, Copy, Open
- Documents tab: documents created or imported in sessions
- Research tab: completed deep research reports
- Archive: restore old sessions

We have no session library. Chats are ephemeral in the app webui.

### 3. Brain Panel (Memory + Skills in one place, user-facing)

Brain is a floating panel with four sub-tabs:

**Memories**: user-curated long-term facts. Import from file (.txt, .md, .pdf, .csv, .json, .log, .py, .js, .html). Export. Search. Enable/disable toggle. Tidy button.

**Skills**: reusable procedures the agent can call via /skill. Confidence-sorted, Audit all with one click, add from GitHub URL (skill folder with SKILL.md), or create manually (title, when to use, how, tags).

**Add tab**: form to add memory or skill.

**Settings tab**:
- Auto-extract memories from conversations (toggle)
- Auto-extract skills from agent workflows (toggle)
- Auto-approve skills at or above confidence threshold (slider, default 85%)
- Inject skills: max skills per request (default 3)

We have memories and skills in the ops admin panel only. Users cannot see or manage their own memory. This is a fundamental product gap - one of Carina's core selling points is "she remembers" but users have zero visibility.

### 4. Tasks / Automation System

Odysseus tasks are cron-based background jobs the user sets up:

**Built-in tasks (all paused by default)**:
- Calendar Classify Events (cron 0 6,18)
- Email Calendar Events (cron 0 */1)
- Email Summary (cron 0 */2)
- Email AI Auto Reply (cron 0 */2)
- Email Tags (cron 0)
- Chat Sessions Tidy (every 5 sessions created)
- Documents Tidy (every 5 documents created)
- Memory Tidy (every 5 memory adds)
- Research Tidy

**Add Task types**:
- Prompt on schedule (daily, weekly, etc.)
- Prompt on event (every N sessions or messages)
- Research on schedule
- Research on event
- Action on schedule (tidy/cleanup on a timer)
- Action on event
- Webhook triggered

Activity log shows recent task runs.

We have nothing like this. Users cannot schedule anything. This is a massive differentiator Odysseus has that we are completely missing.

### 5. Model Comparison Tool

Blind / Parallel / Shuffle / Save / Reset modes.
Types: Chat, Agent, Search, Research.
Multiple models side by side, same prompt, scoreboard.

We have no comparison. Minor for our property SaaS focus but worth noting.

### 6. Deep Research

Multi-step web research with LLM in the loop.
Modes: Auto, Product, Compare, How-to, Fact-check.
Settings: rounds, format, search engine (Tavily with DuckDuckGo fallback), endpoint, model.
Queue multiple research jobs.
Results stored in Library > Research tab.

We have no deep research. This matters for property SaaS: "research this area", "compare these developments", "fact-check this planning application".

### 7. Calendar Integration

Full calendar (week/month/year/agenda view).
Quick add via natural language ("call Telemachus tomorrow morning").
AI tasks can classify and add events automatically.

We have no calendar. Agents can mention dates but cannot interact with a user's calendar.

### 8. Notes

Standalone notes panel with todos, reminders, grid/list view, archive.
Notes can be pinned as context to the active chat session (the "Notes x" pill above the input bar).
Reminders: AI-synthesised reminder messages delivered via browser notification or email.

We have no persistent notes. The context-pinning feature is particularly valuable.

### 9. Settings Depth

**Appearance settings** (granular UI toggles):
- Chat area: Session Header, Welcome Message, Incognito Mode, Text-only Emojis, Thinking Process (collapsible think bars), Sensitive Blur
- Chat bar: Web Search, Document Editor, Shell, More Tools, Agent/Chat toggle, Attach Files, Deep Research, Personas
- Sidebar: every individual element has a show/hide toggle (Odysseus brand, Search, New Chat, Chats, Email, Models, Tools section, Brain, Calendar, Compare, Cookbook, Deep Research, Gallery, Library, Notes, Tasks, Theme, User, Settings Button)

**AI Defaults**:
- Default Chat Model (endpoint + model + fallbacks)
- Utility Model (background tasks, compaction, auto-naming) - separate from chat model
- Vision model
- Research model
- Image generation model
- Email safety toggle (stages drafts, does not send)

**Search Settings**: web search provider (Tavily), results per query, API key, fallback chain

**Integrations**: single place for all external service connections

**Shortcuts**: full keyboard shortcut list, rebindable

**Admin > Agent Tools**: enable/disable individual tools by category (Code 4/4, Search 2/2, Documents 5/5, Media 1/1, Knowledge 2/2, Multi-Agent 3/3, Sessions 4/4, System 9/9, Other 37/37), tool call limit, max steps per message

**Admin > System**: terminal log (live), data backup/export, danger zone (delete all)

Our settings are: API key management. That is it.

### 10. Theme System

14 presets: original, light, midnight, paper, cyberpunk, retrowave, forest, ocean, ume, copper, terminal, organs, lavender, GPT, claude, cute.
Each applies a full colour palette (background, text, accent, borders).
Customize tab for fine-grained overrides.
Live preview ("Peek" button in Appearance settings).

We have one hard-coded dark theme.

### 11. Input Bar

Odysseus input bar (bottom, floating card style):
- Left: expand chevron, web search toggle, shell toggle
- Right: model selector dropdown (shows active model name, click to switch mid-session), Agent/Chat mode toggle, Send button
- Above bar: pinned context chips (Notes, Documents, etc.)
- Expand chevron reveals: Attach files, Documents, Workspace, Prompt sub-menus

Our input bar: textarea + Send button.

### 12. Agent vs Chat Mode

Odysseus distinguishes two modes in the input bar:
- Chat: standard LLM response, no tool calls
- Agent: agentic loop, tool-calling enabled

The active mode is shown in the input bar. Users know exactly what mode they are in.

We have no mode distinction. Every message is always agent mode or always chat mode depending on backend config, with no user control or visibility.

### 13. Cookbook (Local Model Manager)

Hardware scan, HuggingFace download, Ollama serve, dependency installation.
Not relevant for Carina (we do not serve local models). Skip.

### 14. Gallery + Image Editor

Photo manager with AI tagging. Image editor (canvas-based, alpha).
Not relevant for property SaaS right now. Skip.

### 15. Email Panel

Full email client embedded (IMAP connection via integrations).
Relevant later - agents that can read and send email on behalf of users.

---

## Our Current State: Honest Assessment

### app.carinaai.uk (customer webui, Next.js)

Pages that exist:
- Login / Register
- Dashboard (basic)
- Chat panel (ChatPanel.tsx + StreamingMessage.tsx)
- Billing (plan cards, usage meter, Stripe checkout)
- Settings: API key vault (AddKeyDialog, KeyRow, DeleteKeyButton)
- Security page

**What it feels like:** A billing portal with a chat box attached. The chat has streaming (StreamingMessage.tsx exists) but no history, no session library, no memory visibility, no tool transparency, no mode toggle, no model selector. It would embarrass us if placed next to Odysseus.

### ops.carinaai.uk (VERLOX internal admin, Express/EJS)

This is the admin panel, not the product. It has: Dashboard, AI Platform, Tenants, Subscriptions, Security, Channels, Chat, Memories, Skills, Skill Packs, RAG Corpus, Projects, Settings.

The chat in ops is actually richer than the customer webui - it has quick actions and session display. But it is an internal tool. Customers never see it.

---

## Recommended Direction

### Option A: Targeted feature grafts onto existing Next.js app

Add the highest-value missing features to `app.carinaai.uk` incrementally without restructuring. Lower risk, faster to ship.

Downside: the existing component structure is thin and the chat layout would need major surgery anyway to accommodate a sidebar session list and panel system.

### Option B: Full redesign of app.carinaai.uk chat experience (RECOMMENDED)

Adopt Odysseus's information architecture - three-zone layout, panel system, rich chat - but with Carina's identity (property SaaS, green accent, professional tone) and Carina-specific features.

This is the right call because:
1. The current structure is too thin to graft onto without making a mess
2. The chat is the product - everything else (billing, settings) is ancillary
3. A redesign lets us define a design system once rather than retrofitting

---

## Redesign Plan for app.carinaai.uk

### Layout: Three-Zone

```
[LEFT SIDEBAR 220px] | [MAIN CHAT, flex] | [RIGHT PANEL optional, 300px]
```

Left sidebar (collapsible, keyboard shortcut Ctrl+B):
- Carina logo / wordmark
- New Chat button (+ icon)
- Ctrl+K search bar
- Session list (grouped: Today, Yesterday, Last 7 days, Older)
- Section: Tools
  - Memory
  - Skills
  - Notes (pinnable to chat)
  - Research (deep research queue)
  - Tasks
- Bottom: user avatar + name + Settings cog

Main chat:
- Session header: session name (editable on click), message count, model badge
- Message feed: user bubbles right-aligned, assistant left-aligned
- Per-message: copy, delete, (bookmark later), token count + timing shown small below assistant messages
- Tool call blocks: collapsible, show tool name, input code block, output code block
- Thinking process: collapsible section when model returns think tags
- Input bar (floating card at bottom):
  - Left: expand (reveals attach/docs/prompt), web search toggle, shell toggle
  - Center: textarea ("Message Carina...")
  - Right: model selector pill, Agent/Chat mode toggle, Send button
  - Above: context chips (pinned notes, pinned documents)

Right panel (opens as floating overlay or side panel):
- Memory panel
- Skills panel
- Session notes
- Settings

### Feature Priority (build order)

**Phase 1 - Core chat experience (do this now):**
1. Left sidebar with collapsible session list (persisted sessions via existing DB)
2. Rich message bubbles: per-message copy/delete, token count, timing
3. Tool call display (collapsible input/output blocks)
4. Agent/Chat mode toggle in input bar
5. Model selector in input bar (show current model, allow switching)
6. Ctrl+K global session search

**Phase 2 - Memory and Skills visibility (next):**
7. Memory panel (floating, accessible from sidebar): user can view/add/delete their own memories
8. Skills panel: user can see what skills Carina has, confidence scores, manual trigger
9. Context pinning: pin a note or document as context to active session

**Phase 3 - Library and Tasks:**
10. Session library: all sessions searchable, documents, archive
11. Notes: persistent notes with reminder support
12. Tasks: schedule-based prompts (start with "daily summary", "weekly brief")

**Phase 4 - Research and Calendar:**
13. Deep research: property research queries queued and run with web search
14. Calendar: read/write user calendar, AI event classification

**Phase 5 - Polish:**
15. Theme system: 4 presets (dark, light, midnight, forest - Carina branded)
16. Appearance settings: toggle sidebar elements, chat bar elements
17. Keyboard shortcuts page

### What to Skip (for Carina property SaaS)

- Cookbook (local model management) - not applicable
- Gallery / Image editor - not applicable now
- Email client - applicable later (phase 5+)
- Model Comparison tool - applicable later for power users

### Design Identity vs Odysseus

Do NOT copy Odysseus's pink/coral colour scheme. Carina is:
- Accent: #22c55e (green, already established)
- Background: #0f1117 (slightly cooler than Odysseus's warm charcoal)
- Surface: #1a1d27 (panel backgrounds)
- Border: #2d3142
- Text primary: #f0f0f0
- Text muted: #6b7280

Typography: system monospace only in code/tool output. Prose uses Inter or system-ui.

Panel border-radius: 8px (Odysseus uses ~6px - similar clean feel).
No shadows - borders define panels.

### ops.carinaai.uk - What to Fix There

The ops admin is not the product but it is what we use daily. Targeted improvements:
1. Chat tab: adopt the same rich message rendering (token count, tool call display) - reuse the same React components or mirror them in EJS
2. Memory tab: add the "Tidy" operation and bulk import
3. Skills tab: add the confidence audit view
4. Tasks tab: add the cron task manager (this is admin-side automation)
5. The EJS + Express structure is fine for internal tooling - do not redesign it, just fill gaps

---

## Summary

Odysseus beats us on five dimensions that matter most:
1. Chat quality: metadata, tool transparency, per-message controls
2. Memory and skills as a user-facing feature, not an admin detail
3. Session library: nothing is lost, everything is searchable
4. Tasks: scheduled automation is a product differentiator
5. Settings depth: users trust products that let them control things

The redesign of `app.carinaai.uk` chat experience is non-negotiable. The current implementation would not survive a side-by-side demo with Odysseus. The Next.js shell and auth/billing are fine to keep; only the workspace layout and chat components need a full rebuild.

Start with Phase 1 (6 items). That alone closes the most embarrassing gap and makes the chat feel like a real product.
