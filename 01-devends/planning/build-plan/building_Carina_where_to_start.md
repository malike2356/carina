i will build incrementally, and whatever i built, i will ship when it works and tested. Give e a road map. what to build firt, then what next and then on and on till the last piece.
────────────────────────────────────────


╭─  Hermes ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    Here's the roadmap. Each phase ships something working. Nothing depends on "we'll finish it later."
    
    
    
    PHASE 1: PROPERTY AGENT WITH SECURITY
    Ship: The product your website already describes
    
    
    Week 1-2: Core stabilisation
      - Fix any gaps in email ingestion pipeline (02-03 we built)
      - Fix any gaps in Telegram bot (05 we built)
      - Fix any gaps in daily briefing (07 we built)
      - Verify TTS delivery works end-to-end
      - Verify floor plan analysis works end-to-end
      - Run a real email through the pipeline, get a real Telegram briefing
    
    Week 3-4: Scout integration
      - Wire Labyrinth Scout into the agentic loop
      - Prompt injection scanning before every tool call
      - Kill switch accessible from dashboard
      - Audit logging on all tool executions
      - Test: send a malicious prompt, verify Scout blocks it
    
    Week 5: Polish and ship
      - Admin dashboard for survey responses (CSS Survey)
      - Property dashboard with Chart.js
      - Documentation for setting up a new property workspace
      - Ship carinaai.uk as working product
    
    
    Deliverable: A property investor can connect email, get Telegram briefings, upload floor plans, and have Scout protecting the whole thing.
    
    
    
    PHASE 2: POWER TOOLS
    Ship: Hermes-level tool capability
    
    
    Week 6-7: Terminal + file system
      - Full shell execution (terminal tool)
      - Background processes with notifications (process tool)
      - File read/write/patch/search (4 tools)
      - execute_code (Python scripting calling tools)
      - These are the foundation; everything else builds on them
    
    Week 8-9: Browser automation
      - browser_navigate, click, type, scroll, snapshot
      - browser_console (JS execution + error reading)
      - This unlocks web research, form filling, data extraction
    
    Week 10: Subagents + cron
      - delegate_task (parallel subagents, isolated contexts)
      - cronjob (scheduled tasks, chaining, multi-channel delivery)
      - Test: spawn 2 subagents to research 2 properties simultaneously
    
    Week 11: Memory upgrade
      - session_search (FTS5 full-text across all past sessions)
      - Memory consolidation (auto-compress old entries)
    
    
    Deliverable: Carina can do everything Hermes can do; shell, browser, parallel tasks, scheduled automation, session recall.
    
    
    
    PHASE 3: SKILL ECOSYSTEM
    Ship: 70+ skills + domain pack architecture
    
    
    Week 12-13: Port skill library
      - Port all 70+ skills from Hermes to Carina
      - Each skill: SKILL.md with frontmatter, triggers, steps, pitfalls
      - Group into categories (creative, devops, github, mlops, etc.)
      - Verify each skill works on Carina's architecture
    
    Week 14-15: Domain pack system
      - Folder-based pack structure (no npm needed yet)
      - Each pack: prompts/ + tools/ + models/ + data/
      - property-uk as the reference implementation
      - User docs: how to create your own domain pack
      - Test: create a "restaurant-uk" pack from scratch using docs only
    
    Week 16: Tool registration API
      - Plugin interface for custom tools
      - Hot-reload: add a tool file, Carina picks it up
      - Tool manifest: declares name, parameters, description
    
    
    Deliverable: Any developer can create a domain pack for any industry. Carina ships with 70+ general-purpose skills plus property-uk.
    
    
    
    PHASE 4: OPENCLAW FEATURES
    Ship: Workspace intelligence
    
    
    Week 17-18: Workspace system
      - AGENTS.md / SOUL.md / IDENTITY.md / USER.md auto-loading
      - TOOLS.md for tool-specific notes
      - BOOTSTRAP.md for first-run self-configuration
      - Daily memory files (memory/YYYY-MM-DD.md)
      - MEMORY.md curated long-term file
    
    Week 19: Heartbeat + proactivity
      - Heartbeat polling system (~every 30 min)
      - Proactive checks: inbox, calendar, weather, mentions
      - HEARTBEAT.md checklist
      - Heartbeat state tracking (last checked timestamps)
      - Memory maintenance during heartbeats
    
    Week 20: Group chat intelligence
      - Know when to speak vs stay silent in groups
      - Emoji reaction system (Discord, Slack)
      - Platform formatting awareness (no tables on WhatsApp, link suppression on Discord)
      - Triple-tap prevention
    
    
    Deliverable: Carina works as a personal workspace agent, not just a task executor. Checks in on you. Knows when to be quiet.
    
    
    
    PHASE 5: ADVANCED FEATURES
    Ship: What makes Carina unique
    
    
    Week 21-22: Model routing
      - Ollama integration for local model execution
      - Task classifier: route simple queries to local, complex to cloud
      - Cost tracking per model per task
      - Provider switching mid-conversation (claim on your website)
      - Fallback chain: local → cloud primary → cloud backup
    
    Week 23-24: Cross-agent collaboration
      - Shared knowledge protocol (Hermes ↔ OpenClaw ↔ Carina)
      - Task handoff: "Hermes, deploy this. Carina, monitor it."
      - Unified memory namespace
      - 5-minute knowledge sync between agents
    
    Week 25-26: Scout dashboard 2.0
      - Real-time monitoring of all agents
      - Threat alerts with severity levels
      - Usage analytics (tokens, tools, costs per workspace)
      - Compliance reporting export
      - Multi-tenant: one dashboard, many workspaces
    
    Week 27-28: Tool marketplace
      - Public registry for community tools
      - Private registry for enterprise tools
      - Versioning and compatibility checks
      - One-click install from marketplace
    
    
    Deliverable: Carina runs local models, collaborates with other agents, has enterprise-grade monitoring, and a community tool ecosystem.
    
    
    
    TIMELINE SUMMARY:
    
    | Phase                  | Weeks | What ships                             |
    |------------------------|-------|----------------------------------------|
    | 1: Property + Security | 1-5   | Working property agent with Scout      |
    | 2: Power Tools         | 6-11  | Full Hermes tool parity                |
    | 3: Skill Ecosystem     | 12-16 | 70+ skills + domain pack system        |
    | 4: OpenClaw Features   | 17-20 | Workspace intelligence + heartbeat     |
    | 5: Advanced            | 21-28 | Local models, cross-agent, marketplace |
    
    Total: 28 weeks. Ship every 4-6 weeks.
    
    What you can parallelise:
    - Phases 2 and 3 can overlap; port skills while building tools
    - Phase 4 can start during Phase 3; different code areas
    - You can hire someone for Phase 2 (tool porting) while you build Phase 1
    
    What ships first: Phase 1. Property agent with Scout. Everything on carinaai.uk becomes real. That's the foundation; everything else is amplification.
    
    can i build with cursor or claude or you? advice
────────────────────────────────────────


╭─  Hermes ─────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    Use all three. Each for what it's best at.
    
    Cursor; for coding individual files:
    - Best at: writing PHP controllers, tool handlers, frontend components
    - Inline completions speed you up when writing boilerplate (routes, config, migrations)
    - Tab-to-accept is genuinely faster than any chat interface for mechanical code
    - Use it for: any single-file change, fixing bugs, adding fields to models
    - Don't use it for: multi-file architecture decisions, anything that needs to understand the whole system
    
    Claude Code; for self-contained features:
    - Best at: building one complete feature end-to-end with tests
    - Better than Cursor at understanding context across 5-10 files
    - Use it for: "build the model routing layer" or "add the heartbeat system"
    - Don't use it for: anything that needs to run terminal commands against your actual servers
    
    Me (Hermes); for orchestration and system-level work:
    - Best at: multi-step operations across repos, servers, and filesystems
    - I can spawn subagents to build 3 things in parallel
    - I can test things end-to-end (send a real email, verify it arrives, check the Telegram bot responds)
    - I have persistent memory; I remember your stack, your preferences, your conventions
    - Use me for: Phase 1 integration testing, Scout wiring, deployment verification
    - Don't use me for: writing CSS or boilerplate; I'm slower than Cursor for that
    
    The workflow:
    
    
    Morning:   "Karina, build the scaffolding for Phase 2; terminal + file tools.
                Spawn subagents for each tool. Test them end-to-end against the VPS."
    
    Midday:    Open Cursor. "Add rate limiting to the EmailIngestionService."
                Tab-tab-tab. Done in 3 minutes.
    
    Afternoon: Open Claude Code. "Build the model routing layer; local Ollama
                fallback to cloud. Here's the spec."
                Claude writes it, tests it, commits it.
    
    Evening:   "Karina, review everything built today. Run the full test suite.
                Deploy to staging. Send me a briefing on Telegram."
    
    
    What NOT to do:
    Don't try to use one tool for everything. Cursor can't orchestrate. Claude can't deploy. I'm slower at single-file edits. Each phase will need all three at different points. The efficiency gain is in knowing when to switch.
    
    The real answer: You build with all three. The roadmap I gave you is the plan. Cursor is your hands, Claude is your feature builder, I'm your foreman.


