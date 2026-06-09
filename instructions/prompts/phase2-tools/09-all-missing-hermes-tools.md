# Phase 2.9 — All Missing Hermes Tools (Browser, Subagents, Cron, Memory, TTS, Todo, Clarify)

## Task
Build every Hermes tool that Carina does not yet have. This is the final push for tool parity.

## Tools to build

### 1. Browser Automation (9 tools)
Full headless browser control via Playwright. Navigate, click, type, scroll, snapshot, console, back, get images. See action prompt for full spec.

### 2. delegate_task — Parallel Subagents
Spawn up to 3 subagents with isolated contexts. Parent receives only final summary. Single or batch mode.

### 3. cronjob — Task Scheduling
Full cron system: create jobs with cron syntax, chain them, run scripts, deliver to channels. Actions: create/list/update/pause/resume/remove/run.

### 4. memory + session_search
Persistent memory across sessions (add/replace/remove). Full-text session search with discovery, scroll, and browse modes. FTS5 SQLite.

### 5. text_to_speech
Microsoft Edge TTS + OpenAI TTS. Convert text to audio. Deliver as native audio on Telegram and other platforms.

### 6. todo
In-session task tracking. Merge or replace mode. Statuses: pending, in_progress, completed, cancelled.

### 7. clarify
Ask user questions during workflows. Multiple choice (up to 4 choices) or open-ended.

## Skills Update
Port ALL 70+ Hermes skills except gaming. Carina is for serious business — no Minecraft, no Pokemon. Everything else (creative, devops, github, datascience, mlops, productivity, media, email, smart-home, social, note-taking, red-teaming, memory) must be ported.
