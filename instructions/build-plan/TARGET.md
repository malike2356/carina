# TARGET.md — What We Are Building

## The goal

Carina must be the only agent platform that is simultaneously:

1. General-purpose (70+ skills, any industry)
2. Domain-deep (property-uk vertical, user-extensible packs)
3. Secure from day one (Scout — prompt injection shield, kill switch, audit, DLP)
4. Offline-capable (local models for routine, cloud for complex)
5. Open source (MIT — anyone can fork, audit, contribute)
6. Self-improving (writes its own skills, learns from experience)
7. Channel-agnostic (Telegram, Discord, Slack, SMS, web, API)
8. Production-ready (cron scheduling, webhooks, background processes, parallel subagents)

## The gap

No agent currently combines all of these. Hermes has 1, 5, 6. OpenClaw has 5, 6. Claude/ChatGPT have none of 2, 3, 4. Enterprise platforms cost $50k+/year and still lack 2, 6, 7.

Carina fills this gap.

## Scope: everything to include

### From Hermes (40+ tools)
All tools listed in TOOLS.md:
- Terminal: shell, background processes, PTY
- Browser: full automation (navigate, click, type, console, images)
- File system: read, write, patch, search (ripgrep)
- Subagents: delegate_task (3 parallel, isolated contexts)
- Cron: scheduled jobs with chaining and multi-channel delivery
- Messaging: Telegram, Discord, Slack, Signal, Matrix, SMS
- Audio: text-to-speech with native delivery
- Python: execute_code (scripts calling tools programmatically)
- Memory: persistent storage, session search, memory consolidation

### From Hermes (70+ skills)
All categories listed in ROADMAP.md Phase 3:
autonomous-ai-agents, creative, data-science, devops, email, gaming,
github, media, mlops, note-taking, productivity, red-teaming, research,
smart-home, social-media, software-development

### From OpenClaw (workspace features)
- AGENTS.md / SOUL.md / IDENTITY.md / USER.md workspace files
- TOOLS.md tool configuration
- BOOTSTRAP.md first-run setup
- Daily memory files (memory/YYYY-MM-DD.md)
- MEMORY.md curated long-term memory
- Heartbeat system (periodic proactive checks)
- Group chat awareness (speak vs silence rules)
- Reaction system (emoji reactions on supported platforms)

### Domain pack system (user-extensible)
- Folder-based pack structure
- Each pack: prompts/ + tools/ + models/ + data/
- property-uk as reference implementation
- User documentation for creating new packs
- Registry for sharing packs

### Security (Labyrinth Scout)
- Prompt injection shield: regex + LLM judge + tool result scanning
- Moving target deception: randomized system prompt markers
- Kill switch: emergency stop all agent processes
- Egress filtering: block sensitive data from leaving
- Audit log: every tool call, every model request, every response
- Rate limiting: per-tool, per-user, per-session
- Honeypots: fake credentials to detect data leaks
- Real-time dashboard: active sessions, threats, usage

### Unique features (what makes Carina different)
- Domain knowledge injection at framework level
  - Not just prompt-level, actual data stores queried by the agent
  - UK property law, HMO regulations by postcode, live property feeds
- Offline-first with local models
  - Bundled fine-tuned model for property
  - Task classifier routes simple queries to local, complex to cloud
  - 70-80% cost reduction vs cloud-only
- Tool result caching with TTL
  - Cache web searches (1 hour), property data (24 hours), compliance (until expiry)
  - 40% latency reduction for repeat queries
- Proactive alerting from DB state
  - "Tenant late on rent" triggers notification
  - "HMO licence expires in 30 days" triggers alert
  - Event-driven, not polled

## Where Carina lands

Above every open-source agent (Hermes, OpenClaw, CrewAI, AutoGPT).
Above every commercial agent (ChatGPT, Claude, Copilot, Devin).
Competing with enterprise platforms at $50k+/year — but open source and $79/mo.

The combination of general-purpose tools + domain depth + security + offline + open source + self-improving does not exist today. Carina creates the category.
