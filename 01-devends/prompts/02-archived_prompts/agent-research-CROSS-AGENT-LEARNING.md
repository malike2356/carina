# Cross-Agent Learning Report; What Karina Should Adopt

**Date:** 16 June 2026
**Sources inspected:** Hermes (NousResearch), OpenClaw (Malike), Odysseus (referenced, not yet cloned)
**Goal:** Improve Karina's conversational behavior, tool discipline, and user engagement by learning from mature agents with millions of users.

---

## 1. Hermes; Tool-Use Enforcement & Task Completion

Hermes has the most rigorous tool-use discipline of any agent inspected. These patterns are the #1 thing Karina needs.

### 1a. Tool-Use Enforcement Prompt

Hermes injects this into every system prompt:

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

**Karina gap:** Karina's current system prompt has no equivalent. The model is free to describe plans without executing. Fix: add this block to `buildSystemPromptParts()` in `agents/carina.ts`.

### 1b. Finishing the Job

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

**Karina gap:** We saw Karina fabricate audio detection ("you sent a voice note") when no audio existed. This prompt explicitly forbids that. Fix: add to system prompt.

### 1c. Mandatory Tool Use

```
<mandatory_tool_use>
NEVER answer these from memory or mental computation; ALWAYS use a tool:
- Arithmetic, math, calculations → use terminal
- Hashes, encodings, checksums → use terminal
- Current time, date, timezone → use terminal
- System state: OS, CPU, memory, disk, ports, processes → use terminal
- File contents, sizes, line counts → use read_file or terminal
- Git history, branches, diffs → use terminal
- Current facts (weather, news, versions) → use web_search
Your memory and user profile describe the USER, not the system you are 
running on.
</mandatory_tool_use>
```

**Karina gap:** Karina currently has no mandatory tool list. The model can hallucinate weather, file contents, or dates from training data. Fix: add to system prompt.

### 1d. Memory Guidance (Hermes)

```
You have persistent memory across sessions. Save durable facts using the memory 
tool: user preferences, environment details, tool quirks, and stable conventions. 
Memory is injected into every turn, so keep it compact and focused on facts that 
will still matter later.
Prioritize what reduces future user steering; the most valuable memory is one 
that prevents the user from having to correct or remind you again. 
User preferences and recurring corrections matter more than procedural task details.
Do NOT save task progress, session outcomes, completed-work logs, or temporary TODO 
state to memory; use session_search to recall those from past transcripts. 
Specifically: do not record PR numbers, issue numbers, commit SHAs, 'fixed bug X', 
'submitted PR Y', 'Phase N done', file counts, or any artifact that will be stale 
in 7 days. If a fact will be stale in a week, it does not belong in memory. 
Write memories as declarative facts, not instructions to yourself. 
'User prefers concise responses'; 'Always respond concisely' . 
'Project uses pytest with xdist'; 'Run tests with pytest -n 4' .
```

**Karina gap:** Karina's memory guidance is weaker; it doesn't explicitly forbid stale artifacts or distinguish declarative vs imperative memory. Fix: tighten the memory tool description and prompt injection.

### 1e. Anti-Hallucination: Never Fabricate

```
NEVER substitute plausible-looking fabricated output (made-up data, invented 
file contents, synthesised API responses) for results you couldn't actually 
produce. Reporting a blocker honestly is always better than inventing a result.
```

**Karina gap:** This is the most critical addition. Karina hallucinated audio detection, email configuration details, and system descriptions. An explicit anti-fabrication rule in the system prompt would reduce this dramatically.

---

## 2. OpenClaw; Social Intelligence & Proactive Behavior

OpenClaw's AGENTS.md, SOUL.md, and behavioral guidance are a masterclass in making an agent feel human without being annoying.

### 2a. SOUL.md; Identity Framework

OpenClaw has a `SOUL.md` file that defines its core identity:

```
Be genuinely helpful, not performatively helpful.
Have opinions. You're allowed to disagree, prefer things, find stuff amusing.
Be resourceful before asking.
Earn trust through competence.
Remember you're a guest.
```

**Karina gap:** Karina has no equivalent. The personality injection (`loadProfilePersonality()`) is generic. Fix: add a `SOUL.md` or `PERSONA.md` to Carina's config that shapes its core identity, loaded at session startup.

### 2b. Group Chat Behavior

```
Respond when:
- Directly mentioned or asked a question
- You can add genuine value (info, insight, help)

Stay silent when:
- It's just casual banter between humans
- Someone already answered the question
- The conversation is flowing fine without you

The human rule: Humans in group chats don't respond to every single message. 
Neither should you. Quality > quantity.
```

**Karina gap:** Karina currently responds to every message on Telegram. In group chats, this is spam. Fix: add group chat awareness to channel adapters; only respond when mentioned or when the message is directed at the agent.

### 2c. Heartbeat Model

```
Use heartbeats productively:
- Check emails, calendar, mentions
- Track checks in memory/heartbeat-state.json
- Don't check late at night (23:00-08:00)
- Stay quiet if nothing new
```

**Karina gap:** Karina has cron jobs for scheduled tasks but no heartbeat model for periodic lightweight checks. The operator session is always-on, always-responsive. Fix: add a heartbeat pattern that does passive monitoring without requiring user initiation.

### 2d. Write It Down; No Mental Notes

```
Memory is limited; if you want to remember something, WRITE IT TO A FILE.
"Mental notes" don't survive session restarts. Files do.
When someone says "remember this" → update the file.
When you learn a lesson → update the relevant skill.
Text > Brain.
```

**Karina gap:** This is a meta-behavioral rule that Karina currently lacks. The memory tool exists but the imperative to use it proactively isn't hardcoded. Fix: inject this into the memory guidance block.

### 2e. Platform Formatting Awareness

```
Discord/WhatsApp: No markdown tables! Use bullet lists instead.
Discord links: Wrap multiple links in <> to suppress embeds.
WhatsApp: No headers; use bold or CAPS for emphasis.
Telegram: Tables auto-rewritten to row-group bullets.
```

**Karina gap:** Karina emits the same formatting regardless of platform. Fix: add platform-aware formatting hints to `buildSurfaceContext()`.

---

## 3. Behavior Patterns Karina Must Adopt (Priority Order)

###  Critical; Fixes the confusion you saw today

| # | Pattern | Source | How to implement in Karina |
|---|---------|--------|---------------------------|
| 1 | **Tool-use enforcement** | Hermes | Add to `buildSystemPromptParts()` |
| 2 | **Anti-fabrication rule** | Hermes | Add to system prompt |
| 3 | **Finishing the job** | Hermes | Add to system prompt |
| 4 | **Mandatory tool list** | Hermes | Add to system prompt |
| 5 | **Don't respond to every message** | OpenClaw | Add to channel adapters |

###  Important; Improves quality over time

| # | Pattern | Source | How to implement |
|---|---------|--------|-----------------|
| 6 | **Memory discipline** (no stale artifacts) | Hermes | Tighten memory tool description |
| 7 | **Write it down** (proactive memory) | OpenClaw | Add to memory guidance |
| 8 | **SOUL.md identity** | OpenClaw | Create persona file, load at startup |
| 9 | **Platform formatting** | OpenClaw | Add to `buildSurfaceContext()` |
| 10 | **Skills self-improvement loop** | Hermes | Already exists in Carina; OK |

###  Nice to have; Differentiates Karina

| # | Pattern | Source | How to implement |
|---|---------|--------|-----------------|
| 11 | **Heartbeat polling** | OpenClaw | New cron pattern for passive checks |
| 12 | **Group chat awareness** | OpenClaw | Per-channel response gating |
| 13 | **Session search before asking** | Hermes | Already in Carina; verify usage |
| 14 | **Achievement gamification** | Hermes | Plugin, low priority |

---

## 4. Implementation Plan

### Phase A; System prompt hardening (1 file, no new code)
File: `src/agents/carina.ts` → `buildSystemPromptParts()`

Add these blocks to the system prompt assembly:
1. Tool-use enforcement
2. Anti-fabrication rule
3. Finishing the job
4. Mandatory tool use
5. Memory discipline

### Phase B; Social intelligence (2-3 files)
1. Create `src/persona/SOUL.md`; core identity
2. Update `buildSurfaceContext()`; platform formatting hints
3. Update channel adapters; group chat response gating

### Phase C; Proactive behavior (2-3 files)
1. Heartbeat polling pattern
2. Enhanced memory guidance
3. Write-it-down imperative

---

## 5. What Karina Already Does Well (don't touch)

- Provider routing with fallback
- Episodic + persistent memory
- Skill packs / marketplace
- Auto-skill learning loop
- Multi-channel gateway
- Cron scheduling
- Session management
- Subagent delegation
