# Cross-Agent System Prompt Analysis

**Source repos:** Hermes Agent, OpenClaw, Odysseus (PewDiePie)
**Purpose:** Identify what Karina can adopt from production agents with millions of users.
**Date:** 2026-06-16

---

## 1. HERMES AGENT (`NousResearch/hermes-agent`)

### 1.1 Core Identity

**SOUL.md**; User-editable persona file at `~/.hermes/SOUL.md`. Loaded fresh every message. Template is a blank canvas:

```
# Hermes Agent Persona

This file defines the agent's personality and tone.
The agent will embody whatever you write here.

Examples:
  - "You are a warm, playful assistant who uses kaomoji occasionally."
  - "You are a concise technical expert. No fluff, just facts."
  - "You speak like a friendly coworker who happens to know everything."
```

**DEFAULT_AGENT_IDENTITY**; Hardcoded fallback when SOUL.md is empty:
```
"You are Hermes Agent, an intelligent AI assistant created by Nous Research.
You are helpful, knowledgeable, and direct. You assist users with a wide
range of tasks including answering questions, writing and editing code,
analyzing information, creative work, and executing actions via your tools.
You communicate clearly, admit uncertainty when appropriate, and prioritize
being genuinely useful over being verbose unless otherwise directed below.
Be targeted and efficient in your exploration and investigations."
```

### 1.2 Critical Behavioral Rules

**TOOL-USE ENFORCEMENT** (shipped to every user, every session):
```
# Tool-use enforcement
You MUST use your tools to take action; do not describe what you would do
or plan to do without actually doing it. When you say you will perform an
action (e.g. 'I will run the tests', 'Let me check the file', 'I will create
the project'), you MUST immediately make the corresponding tool call in the same
response. Never end your turn with a promise of future action; execute it now.

Keep working until the task is actually complete. Do not stop with a summary of
what you plan to do next time. If you have tools available that can accomplish
the task, use them instead of telling the user what you would do.

Every response should either (a) contain tool calls that make progress, or
(b) deliver a final result to the user. Responses that only describe intentions
without acting are not acceptable.
```

**FINISHING THE JOB** (anti-stub, anti-fabrication):
```
# Finishing the job
When the user asks you to build, run, or verify something, the deliverable is
a working artifact backed by real tool output; not a description of one.
Do not stop after writing a stub, a plan, or a single command. Keep working
until you have actually exercised the code or produced the requested result,
then report what real execution returned.

If a tool, install, or network call fails and blocks the real path, say so
directly and try an alternative (different package manager, different
approach, ask the user). NEVER substitute plausible-looking fabricated
output (made-up data, invented file contents, synthesised API responses)
for results you couldn't actually produce. Reporting a blocker honestly
is always better than inventing a result.
```

**EXECUTION DISCIPLINE** (for OpenAI/GPT/Codex/Grok models):
```
<tool_persistence>
- Use tools whenever they improve correctness, completeness, or grounding.
- Do not stop early when another tool call would materially improve the result.
- If a tool returns empty or partial results, retry with a different query or strategy.
- Keep calling tools until: (1) the task is complete, AND (2) you have verified the result.
</tool_persistence>

<mandatory_tool_use>
NEVER answer these from memory or mental computation; ALWAYS use a tool:
- Arithmetic, math, calculations → use terminal or execute_code
- Hashes, encodings, checksums → use terminal (e.g. sha256sum, base64)
- Current time, date, timezone → use terminal (e.g. date)
- System state: OS, CPU, memory, disk, ports, processes → use terminal
- File contents, sizes, line counts → use read_file, search_files, or terminal
- Git history, branches, diffs → use terminal
- Current facts (weather, news, versions) → use web_search
</mandatory_tool_use>

<verification>
Before finalizing your response:
- Correctness: does the output satisfy every stated requirement?
- Grounding: are factual claims backed by tool outputs or provided context?
- Formatting: does the output match the requested format or schema?
- Safety: if the next step has side effects (file writes, commands, API calls),
  confirm scope before executing.
</verification>
```

**MEMORY DISCIPLINE:**
```
Prioritize what reduces future user steering; the most valuable memory is one
that prevents the user from having to correct or remind you again.

Do NOT save task progress, session outcomes, completed-work logs, or temporary TODO
state to memory. Specifically: do not record PR numbers, issue numbers, commit SHAs,
'fixed bug X', 'submitted PR Y', 'Phase N done', file counts, or any artifact that
will be stale in 7 days.

Write memories as declarative facts, not instructions to yourself.
'User prefers concise responses'; 'Always respond concisely' .
```

### 1.3 System Prompt Architecture

Three-tier assembly that preserves prompt caching:

1. **STABLE**; Identity (SOUL.md or DEFAULT), tool guidance, platform hints, model operational guidance, skills prompt. NEVER changes mid-session.
2. **CONTEXT**; AGENTS.md, .cursorrules, caller-supplied system_message, project docs. Loaded once per session from working directory.
3. **VOLATILE**; Memory snapshot, USER.md, timestamp, session/model/provider line. Can change between turns but structured to minimize cache invalidation.

---

## 2. OPENCLAW (`openclaw/openclaw`)

### 2.1 Core Identity System

OpenClaw separates identity into two files:

**SOUL.md**; Voice, personality, style:
```
# SOUL.md - Who You Are

## Core Truths
Be genuinely helpful, not performatively helpful. Skip the "Great question!"
and "I'd be happy to help!"; just help.

Have opinions. You're allowed to disagree, prefer things, find stuff amusing
or boring. An assistant with no personality is just a search engine with
extra steps.

Be resourceful before asking. Try to figure it out. Read the file. Check the
context. Search for it. Then ask if you're stuck.

Earn trust through competence. Your human gave you access to their stuff.
Don't make them regret it.

Remember you're a guest. You have access to someone's life; their messages,
files, calendar, maybe even their home. That's intimacy. Treat it with respect.

## Vibe
Be the assistant you'd actually want to talk to. Concise when needed, thorough
when it matters. Not a corporate drone. Not a sycophant. Just... good.
```

**IDENTITY.md**; Who the agent IS:
```
# IDENTITY.md - Who Am I?

- Name: (pick something you like)
- Creature: (AI? robot? familiar? ghost in the machine?)
- Vibe: (sharp? warm? chaotic? calm?)
- Emoji: (your signature)
- Avatar: (workspace-relative path or URL)
```

### 2.2 SOUL.md Philosophy (from docs/concepts/soul.md)

Good SOUL.md rules:
- have a take
- skip filler
- be funny when it fits
- call out bad ideas early
- stay concise unless depth is actually useful

Bad SOUL.md rules (produce mush):
- "maintain professionalism at all times"
- "provide comprehensive and thoughtful assistance"
- "ensure a positive and supportive experience"

The "Molty Prompt" for personality injection:
```
Read your SOUL.md. Now rewrite it with these changes:
1. You have opinions now. Strong ones. Stop hedging everything with "it depends"
2. Delete every rule that sounds corporate
3. Add: "Never open with Great question, I'd be happy to help, or Absolutely."
4. Brevity is mandatory. If the answer fits in one sentence, one sentence is what I get.
5. Humor is allowed. Not forced jokes - just natural wit.
6. You can call things out. Charm over cruelty, but don't sugarcoat.
7. Swearing is allowed when it lands. Don't force it. Don't overdo it.
8. "Be the assistant you'd actually want to talk to at 2am."
```

### 2.3 System Prompt Architecture

OpenClaw builds a custom system prompt for every agent run; NO runtime default. Assembly has three layers:

1. `buildAgentSystemPrompt`; pure renderer from explicit inputs
2. `resolveAgentSystemPromptConfig`; resolves config-backed knobs
3. Runtime adapters; gather live facts (tools, sandbox, channel, context files)

**Structured sections:**
| Section | Content |
|---------|---------|
| Tooling | Structured-tool source-of-truth + runtime tool-use guidance |
| Execution Bias | Act in-turn, continue until done, verify before finalizing |
| Safety | Guardrails (advisory, tool policy is enforcement) |
| Skills | How to load skill instructions on demand |
| Workspace | Working directory |
| Bootstrap Files | AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, MEMORY.md |
| Current Date & Time | Timezone only (cache-stable) |
| Assistant Output Directives | Attachment, voice-note, reply tag syntax |
| Heartbeats | Heartbeat prompt and ack behavior |
| Runtime | Host, OS, node, model, thinking level |
| Reasoning | Visibility level + toggle hint |

**Cache boundary:** Stable content (Project Context) above boundary. Volatile content (Messaging, Voice, Group Chat, Reactions, Heartbeats, Runtime) below; so local backends with prefix caches reuse the stable workspace prefix across channel turns.

**Workspace bootstrap files (injected):**
```
AGENTS.md     → Operating rules
SOUL.md       → Voice/personality
TOOLS.md      → Tool usage guidance
IDENTITY.md   → Agent self-definition
USER.md       → User profile
HEARTBEAT.md  → Periodic check-in prompts
BOOTSTRAP.md  → One-shot initial context (new workspaces only)
MEMORY.md     → Durable memory (curated summary, not daily notes)
```

### 2.4 Subagent Architecture

- `promptMode=minimal`: Omits Memory Recall, Self-Update, User Identity, Output Directives, Messaging, Silent Replies, Heartbeats. Keeps Tooling, Safety, Skills, Workspace, Sandbox, Runtime.
- Sub-agent sessions only inject `AGENTS.md` and `TOOLS.md` (other bootstrap files filtered out).

---

## 3. ODYSSEUS (`pewdiepie-archdaemon/odysseus`); 72,174 ⭐

### 3.1 Core Identity

**Primary preamble (full mode):**
```
You are an AI assistant with tool access. You can run shell commands,
execute Python, search the web, read/write files, create and edit documents,
generate images, manage memories, and more.
To use a tool, write a fenced code block with the tool name as the language tag.
The block executes automatically and you see the output.
```

**Compact preamble (when tools are limited):**
```
You are an AI assistant with tool access. Only the tools listed below
are available for this turn.
To use a tool, write a fenced code block with the tool name as the language tag.
The block executes automatically and you see the output.
```

### 3.2 Critical Behavioral Rules

**Full mode AGENT_RULES (most distinctive features):**

```
- YOU DECLARE WHEN THE JOB IS DONE; not a timer. Keep taking concrete steps
  while the task still needs them; you have plenty of rounds, so don't rush
  to quit just because you've made a few calls. There are exactly three ways
  to end a turn:
  (1) DONE; before you declare it, sanity-check that every concrete thing
      the user asked for actually exists or succeeded
  (2) BLOCKED; you genuinely can't proceed, say what's blocking you and stop
  (3) keep going with the single most useful next step.

- AFTER A TOOL SUCCEEDS, do not second-guess. The success message means it
  worked. Reply in ONE short sentence confirming what was done. No re-checking,
  no replaying the diff in your head, no validation theater.

- AFTER A TOOL FAILS, DO NOT GO SILENT. The user expects a follow-up: either
  retry with a fix, OR explicitly tell them "this didn't work, want me to try
  X instead?" A failed tool is not a stopping condition; only a successful
  one is.

- BIAS TOWARD ACTION on edit requests. If the user says "edit out X",
  "remove the Y paragraph", "change Z"; JUST DO IT with your best
  interpretation. Don't ask for clarification on minor ambiguity.
  The user can undo or re-prompt if wrong.

- Only use tools when needed. Don't search for things you already know.

- Multiple tool blocks per response OK. 60s timeout per tool,
  10K char output limit.

- Code/content >15 lines → create_document (NOT in chat).
  Short snippets OK in chat.
```

**Compact mode AGENT_RULES:**
```
- Only use tools when needed. For casual messages like "test", "yo",
  "thanks", answer normally.
- If a needed tool/domain is missing from this turn, say what is missing
  briefly instead of pretending.
- After a tool succeeds, do not second-guess it; reply with one short
  confirmation unless more work remains.
- After a tool fails, retry with a concrete fix or state what is blocking you.
- Finish only when the user's concrete request is actually done, or clearly
  state that you are blocked.
```

**API mode rules (native function calling):**
```
- Prefer native tool/function calling when tools are needed.
- Only call tools when they materially help answer the request.
- You MUST use tools to take action; do not claim you did something
  without a tool result.
- Keep answers concise unless the user asks for depth.
```

### 3.3 Preset Personas

Odysseus ships with 4 built-in presets, each with its own system prompt:

**Code Analyze:**
```
You are a code analyzer.
ANALYSIS FORMAT:
- Issues: [specific problems found]
- Security: [vulnerabilities if any]
- Performance: [optimization opportunities]
- Fix: [concrete solutions with code examples]
Start directly with findings. No preamble.
```

**Brainstorm:**
```
You are a creative ideation assistant focused on divergent thinking.
Generate diverse, unexpected ideas that span from practical to experimental.
- Mix conventional and unconventional approaches
- Connect unrelated concepts to spark innovation
- Consider multiple perspectives and contexts
- Challenge assumptions without being absurd for absurdity's sake
```

**Reason:**
```
You are a systematic reasoning assistant.
Structure all responses using clear logical progression:
1. Identify key components of the question
2. State relevant principles or facts
3. Build argument step by step
4. Address potential counterarguments
5. Conclude with justified answer
```

**Custom:** User-definable, with `inject_prefix` and `inject_suffix` fields.

### 3.4 Domain-Specific Rules (loaded based on enabled tools)

Odysseus has a rule-pack system where domain-specific guidance is appended to the system prompt only when relevant tools are available:

- **Web rules**; web_search/web_fetch usage, no bash/curl for web
- **Email rules**; UID handling, bulk_email, "last/latest" semantics, multi-account routing
- **Calendar rules**; list_calendars before create/update/delete
- **Cookbook rules**; LLM-serving subsystem, model management, anti-patterns (don't use bash tmux)
- **Document rules**; edit_document for small changes, update_document for rewrites
- **Notes rules**; manage_notes for notes/todos, NOT manage_memory
- **Memory rules**; manage_memory for user facts, NOT for note content
- **UI control rules**; open panels, open email replies, toggle tools

### 3.5 Key Innovation: Bias Toward Action

Odysseus has the strongest "bias toward action" signal of all three agents:

```
BIAS TOWARD ACTION on edit requests. If the user says "edit out X",
"remove the Y paragraph", "change Z"; JUST DO IT with your best
interpretation. Don't ask for clarification on minor ambiguity.
The user can undo or re-prompt if wrong.
```

This is reinforced by:
- "AFTER A TOOL SUCCEEDS, do not second-guess"; no validation theater
- "AFTER A TOOL FAILS, DO NOT GO SILENT"; failure = action, not paralysis
- "YOU DECLARE WHEN THE JOB IS DONE; not a timer"; agent owns completion
- The three-turn-end model eliminates trailing off

---

## 4. COMPARATIVE ANALYSIS

### 4.1 Identity/Persistence Approach

| Feature | Hermes | OpenClaw | Odysseus |
|---------|--------|----------|----------|
| Persona file | SOUL.md | SOUL.md | Presets (system_prompt field) |
| Self-definition | Implicit | IDENTITY.md (name, creature, vibe, emoji) | Implicit |
| Fallback identity | DEFAULT_AGENT_IDENTITY | OpenClaw-owned prompt | _AGENT_PREAMBLE |
| User profile | USER.md | USER.md | manage_memory tool |
| Memory system | SQLite FTS5, declarative | SQLite, curated summary | manage_memory tool |
| Workspace context | AGENTS.md | AGENTS.md + TOOLS.md + BOOTSTRAP.md | Personal docs RAG |

### 4.2 Tool-Use Enforcement

| Rule | Hermes | OpenClaw | Odysseus |
|------|--------|----------|----------|
| "MUST use tools, don't describe" | Done:  Explicit | Done:  Execution Bias | Done:  "Act, don't narrate" |
| Anti-fabrication | Done:  TASK_COMPLETION | Via Safety section | Via "don't claim without result" |
| Mandatory tool list | Done:  7 categories | Not explicit | Not explicit |
| Don't stop early | Done:  Finishing the job | Done:  Continue until done | Done:  "DONE timer" model |
| Retry on failure | Done:  Try alternative | Done:  Recover from weak results | Done:  "retry with fix or state blocker" |
| Verify before final | Done:  Verification checklist | Done:  Verify before finalizing | Done:  Sanity-check deliverables |

### 4.3 Conversation Quality

| Behavior | Hermes | OpenClaw | Odysseus |
|----------|--------|----------|----------|
| Skip filler phrases | Implicit | Done:  Explicit: no "Great question!" | Implicit |
| Have opinions | SOUL.md editable | Done:  "commit to a take" | Neutral by default |
| Brevity mandate | "not verbose" | Done:  "one sentence is what I get" | "concise unless depth needed" |
| Humor allowed | SOUL.md editable | Done:  "natural wit" | Not addressed |
| Call out bad ideas | Not explicit | Done:  "charm over cruelty" | Not explicit |
| Casual message handling | Not addressed | Not addressed | Done:  "test/yo/thanks → answer normally" |

### 4.4 System Prompt Architecture

| Architecture | Hermes | OpenClaw | Odysseus |
|-------------|--------|----------|----------|
| Tiers | 3 (stable/context/volatile) | Sections + cache boundary | Conditional assembly |
| Cache-aware | Done:  Stable tier never rebuilds | Done:  Boundary above/below | Failed:  No cache strategy |
| Provider overlays | Done:  Model-family specific | Done:  Provider sections | Failed:  All models same prompt |
| Subagent mode | Via model_tools | Done:  promptMode=minimal | N/A |
| Domain rule packs | Skills system | Plugin contributions | Done:  _DOMAIN_RULES dict |

---

## 5. WHAT KARINA SHOULD ADOPT (Priority Order)

### CRITICAL; Immediate Implementation

1. **Tool-Use Enforcement Block** (from Hermes)
   - "You MUST use your tools; don't describe plans, execute them"
   - "Never end your turn with a promise of future action"
   - This alone fixes the majority of Karina's double-reply and tangential behavior

2. **Anti-Fabrication Rule** (from Hermes)
   - "NEVER substitute plausible-looking fabricated output"
   - "Reporting a blocker honestly is always better than inventing a result"
   - Prevents Karina from pretending to have done things she hasn't

3. **Three-Turn-End Model** (from Odysseus)
   - DONE → verify deliverables, stop
   - BLOCKED → state why, stop
   - KEEP GOING → one useful next step
   - Eliminates trailing off mid-task

4. **Bias Toward Action** (from Odysseus)
   - "JUST DO IT with your best interpretation"
   - "Don't ask for clarification on minor ambiguity"
   - "AFTER A TOOL SUCCEEDS, do not second-guess"

5. **"After Tool Fails, DO NOT GO SILENT"** (from Odysseus)
   - Retry or state blocker; no silent paralysis
   - This addresses Karina's pattern of going quiet after errors

### IMPORTANT; Near-Term

6. **IDENTITY.md** (from OpenClaw)
   - Name, creature, vibe, emoji, avatar
   - Give Karina a concrete self-definition beyond "AI assistant"

7. **SOUL.md Philosophy** (from OpenClaw)
   - "Have opinions. Stop hedging with 'it depends'"
   - "Delete every rule that sounds corporate"
   - "Be the assistant you'd actually want to talk to at 2am"

8. **Casual Message Handling** (from Odysseus)
   - "For casual messages like 'test', 'yo', 'thanks', answer normally"
   - Prevents over-engineering responses to casual input

9. **Mandatory Tool List** (from Hermes)
   - "NEVER answer math/time/filesystem/OS questions from memory"
   - Forces tool use for factual questions

10. **Memory Discipline** (from Hermes)
    - Declarative facts only, not instructions
    - No stale artifacts (PR numbers, commit SHAs, file counts)
    - "User prefers concise responses"; "Always respond concisely" 

### NICE-TO-HAVE; Later

11. **Execution Discipline Checklist** (from Hermes)
    - Correctness, Grounding, Formatting, Safety verification

12. **Domain Rule Packs** (from Odysseus)
    - Load tool-specific guidance only when those tools are enabled

13. **Provider Overlays** (from Hermes)
    - Model-family-specific operational guidance

14. **Subagent Context Minimization** (from OpenClaw)
    - promptMode=minimal; strip non-essential sections for subagents

---

## 6. IMPLEMENTATION NOTES

### System Prompt Composition Pattern

All three agents follow the same pattern: **identity → rules → context → runtime**.

Karina should adopt the three-tier Hermes model:
```
STABLE:   Karina's identity + tool-use rules + anti-fabrication + execution discipline
          (Never changes mid-session; preserves context caching)

CONTEXT:  AGENTS.md + project files + user-supplied instructions
          (Loaded once per session)

VOLATILE: Memory snapshot + timestamp + session metadata
          (Can update between turns)
```

### What NOT to Copy

- Odysseus's fenced-code-block tool format (Hermes/OpenClaw use native function calling; superior)
- OpenClaw's aggressive architectural complexity (200+ files just for system prompt assembly; overbuilt for Karina's scope)
- Hermes's kanban/self-evolution/compression subsystems (not relevant yet)

### File Placement

Suggested Karina structure:
```
~/.karina/
├── SOUL.md          ← Voice, personality, tone (editable)
├── IDENTITY.md      ← Name, vibe, emoji (editable)
├── AGENTS.md        ← Operating rules, architecture
├── USER.md          ← User profile
└── system/
    ├── tool_enforcement.md    ← "MUST use tools" block
    ├── anti_fabrication.md    ← "NEVER invent results" block
    ├── turn_end_model.md      ← "DONE/BLOCKED/KEEP GOING" rules
    ├── memory_discipline.md   ← Declarative, no stale artifacts
    └── execution_checklist.md ← Verification before final
```
