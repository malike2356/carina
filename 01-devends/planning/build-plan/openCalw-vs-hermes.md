ompare yourself to openclaw
────────────────────────────────────────


╭─  Hermes ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    Architecture:
    
    |               | Hermes                                         | OpenClaw                                        |
    |---------------|------------------------------------------------|-------------------------------------------------|
    | Type          | Full autonomous agent platform                 | Workspace-scoped personal agent                 |
    | Scope         | System-wide; any directory, any server        | Single workspace folder                         |
    | Session model | Persistent conversation with memory injection  | Fresh each session, rebuilds context from files |
    | Config        | config.yaml; providers, tools, profiles, cron | AGENTS.md + SOUL.md + USER.md + TOOLS.md        |
    | Install       | CLI binary + config                            | Folder with markdown files                      |
    
    Tools:
    
    |           | Hermes                                                | OpenClaw         |
    |-----------|-------------------------------------------------------|------------------|
    | Terminal  | Full shell (foreground, background, PTY)              | Basic            |
    | Browser   | Full automation; navigate, click, type, JS console   | None             |
    | Subagents | delegate_task; 3 parallel, isolated contexts         | None             |
    | Cron      | Scheduled jobs with chaining, multi-channel delivery  | None             |
    | File ops  | read, write, patch, search (ripgrep)                  | Basic read/write |
    | Messaging | Telegram, Discord, Slack, Signal, Matrix, SMS         | None             |
    | Audio     | Text-to-speech with native delivery                   | None             |
    | Python    | execute_code; scripts calling tools programmatically | None             |
    
    Memory:
    
    |             | Hermes                                         | OpenClaw                                  |
    |-------------|------------------------------------------------|-------------------------------------------|
    | Storage     | SQLite DB; injected every turn                | Markdown files in workspace               |
    | Long-term   | memory tool; compact, durable facts           | MEMORY.md; curated by agent              |
    | Daily logs  | Not native (session_search instead)            | memory/YYYY-MM-DD.md; raw daily notes    |
    | Recall      | session_search; FTS5 across all past sessions | Agent re-reads daily files                |
    | Portability | Locked to Hermes instance                      | Plain markdown; portable, human-readable |
    
    Learning & Adaptation:
    
    |                  | Hermes                                                | OpenClaw                                 |
    |------------------|-------------------------------------------------------|------------------------------------------|
    | Skills           | skill_manage; create/edit/delete reusable procedures | None; learns by updating markdown files |
    | Skill library    | 70+ pre-built skills across 20 categories             | None                                     |
    | Self-improvement | Can write new skills from experience                  | Updates AGENTS.md, TOOLS.md, MEMORY.md   |
    | Corrections      | Memory tool saves preferences immediately             | Writes to daily memory or corrects files |
    
    Proactivity:
    
    |                 | Hermes                                    | OpenClaw                                  |
    |-----------------|-------------------------------------------|-------------------------------------------|
    | Scheduled tasks | cronjob; exact timing, complex scripts   | Heartbeat; polling every ~30 min         |
    | Background work | process; long-running with notifications | None                                      |
    | Event-driven    | Webhook subscriptions                     | None                                      |
    | Idle behavior   | Waits for user                            | Heartbeat checks inbox, calendar, weather |
    
    Strengths:
    
    | Hermes                                  | OpenClaw                                         |
    |-----------------------------------------|--------------------------------------------------|
    | Raw capability; more tools, more power | Simplicity; zero config, just markdown          |
    | Complex multi-step automation           | Workspace organization and journaling            |
    | Parallel execution via subagents        | Human-readable memory you can edit in any editor |
    | Production deployment (cron, webhooks)  | Perfect for personal knowledge management        |
    | 70+ skills covering 20 domains          | Heartbeat system; proactively checks on you     |
    | Multi-platform messaging                | Awareness of when to speak vs stay silent        |
    
    Weaknesses:
    
    | Hermes                                               | OpenClaw                          |
    |------------------------------------------------------|-----------------------------------|
    | Complex configuration                                | No browser, no subagents, no cron |
    | Memory is opaque SQLite; you can't browse it easily | No messaging platform integration |
    | No heartbeat/polling system                          | No multi-step automation          |
    | No built-in daily journaling                         | No Python scripting               |
    | No group chat awareness                              | No terminal background processes  |
    
    When to use which:
    
    | Scenario                                                    | Use      |
    |-------------------------------------------------------------|----------|
    | Build Propreneur features across multiple repos             | Hermes   |
    | Run a server migration at 2am                               | Hermes   |
    | Deploy to VPS, monitor logs, send alerts                    | Hermes   |
    | Keep a daily work journal                                   | OpenClaw |
    | Organize project files and notes                            | OpenClaw |
    | Passive inbox/calendar checking                             | OpenClaw |
    | Write a property deal analysis while also updating your CRM | Hermes   |
    | Remember that you prefer audio briefings at 8am             | Either   |
    
    The real difference:
    
    OpenClaw is designed to be your quiet, organized colleague who keeps a tidy desk, takes good notes, and checks in on you a few times a day. Hermes is the one you call when something needs to get built, deployed, debugged, or automated at 3am. Different tools for different jobs. You have both installed; that's not redundancy, that's the right setup.

