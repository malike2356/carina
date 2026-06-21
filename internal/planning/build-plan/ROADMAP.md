# ROADMAP.md; Carina Build Plan

5 phases. Each ships something working. Build incrementally.

---

## PHASE 1: PROPERTY AGENT WITH SECURITY
**Duration: 5 weeks**
**Ship: The product carinaai.uk already describes**

### Week 1-2: Core stabilisation

Fix any gaps in the existing Propreneur-v2 Carina service:

- Email ingestion pipeline (specs 02-03)
  - Verify EmailIngestionService connects to IMAP
  - Verify EmailParserService classifies and extracts correctly
  - Verify EmailProcessingPipeline dispatches handler jobs
  - Test: send a real email, verify it appears in email_processing_logs

- Telegram bot (spec 05)
  - Verify TelegramWebhookController returns 200 within 2 seconds
  - Verify ProcessTelegramMessage job processes messages
  - Verify CarinaTelegramAgent uses correct persona prompt
  - Test: send a Telegram message, verify bot responds

- Daily briefing (spec 07)
  - Verify daily-portfolio-summary task is in CarinaScheduledAgentService
  - Verify it calls get_portfolio_summary, get_compliance_items, get_rent_arrears, get_recent_email_activity
  - Test: trigger briefing manually, verify output format

- TTS delivery (spec 06)
  - Verify TextToSpeechService generates valid MP3
  - Verify CarinaScheduledAgentDelivery sends text + audio
  - Test: generate audio from briefing, verify it plays

- Floor plan analysis (spec 08)
  - Verify FloorPlanAnalysisService calls vision model
  - Verify BoqCalculationService generates cost estimates
  - Verify FloorPlanComplianceAdvisor flags HMO issues
  - Test: upload a sample floor plan, verify analysis output

- Mobile API (spec 09)
  - Verify all 15 mobile routes are registered
  - Verify authentication flow with Sanctum tokens
  - Test: curl the login endpoint, verify token returned

### Week 3-4: Scout integration

- Wire Labyrinth Scout into the agentic loop
  - Prompt injection scanning before every tool call
  - Three-layer detection: regex, LLM judge, tool result scanning
- Kill switch accessible from dashboard
  - Emergency stop for all agent processes
  - One-click from security dashboard
- Audit logging on all tool executions
  - Every tool call logged with timestamp, user, parameters, result
  - Searchable audit trail
- Test: send a prompt injection attack, verify Scout blocks it
- Test: trigger kill switch, verify all processes stop

### Week 5: Polish and ship

- Admin dashboard for survey responses (CSS Survey)
  - Chart.js analytics
  - Response browsing and export
- Property dashboard for investors
  - Portfolio overview with Chart.js
  - Compliance status indicators
  - Email activity feed
- Documentation
  - Setup guide for new property workspace
  - Admin guide for Scout dashboard
  - Developer guide for extending with custom tools
- Ship carinaai.uk with all of the above functional

### Phase 1 deliverable
A property investor can:
- Connect their email
- Receive Telegram briefings with audio
- Upload floor plans for analysis
- Have Scout protecting every interaction
- Admin can view dashboard, browse responses, export data

---

## PHASE 2: POWER TOOLS
**Duration: 6 weeks**
**Ship: Full Hermes-level tool capability**

### Week 6-7: Terminal + file system

Implement these tools (use TOOLS.md for full specs):

- terminal; Full shell execution (foreground, background, PTY modes)
- process; Background process orchestration
- read_file; Line-numbered file reading with pagination
- write_file; File writing with auto-syntax-check
- patch; Targeted find-and-replace with fuzzy matching
- search_files; Ripgrep-backed content and file search
- execute_code; Python scripts that can call other tools

### Week 8-9: Browser automation

- browser_navigate; Load any URL
- browser_click; Click elements by ref ID
- browser_type; Type into form fields
- browser_press; Keyboard shortcuts
- browser_scroll; Page scrolling
- browser_snapshot; Accessibility tree snapshot
- browser_console; JavaScript execution and error reading
- browser_back; Navigation history
- browser_get_images; Extract all page images

### Week 10: Subagents + cron

- delegate_task; Spawn up to 3 parallel subagents
  - Isolated contexts, separate terminal sessions
  - Configurable toolsets per subagent
  - Status reporting and result collection
- cronjob; Scheduled task system
  - Cron syntax scheduling
  - Background scripts (Python + bash)
  - Multi-channel delivery (Telegram, Discord, email)
  - Job chaining via context_from

### Week 11: Memory upgrade

- session_search; Full-text search across all past sessions
  - FTS5 SQLite backend
  - Deduplication by session lineage
  - Scroll and discovery modes
- memory_consolidation; Auto-compress old memory entries
  - Remove stale data
  - Merge related entries
  - Keep within size limits

### Phase 2 deliverable
Carina has terminal access, browser automation, parallel subagents, cron scheduling, and full-text session search. Feature parity with Hermes tools.

---

## PHASE 3: SKILL ECOSYSTEM
**Duration: 5 weeks**
**Ship: 70+ skills + domain pack architecture**

### Week 12-13: Port skill library

Port all Hermes skills to Carina format:

Categories:
- autonomous-ai-agents (delegation to Claude Code, Codex, OpenCode)
- creative (ASCII art, diagrams, infographics, pixel art, music, video)
- data-science (Jupyter live kernel)
- devops (Kanban orchestration, server troubleshooting)
- email (Himalaya CLI)
- gaming (Minecraft servers, Pokemon)
- github (PRs, code review, issues, repo management)
- media (YouTube, GIF search, Spotify, audio analysis)
- mlops (HuggingFace, vLLM, llama.cpp, SAM, evaluation)
- note-taking (Obsidian)
- productivity (Airtable, Google Workspace, Linear, Notion, PowerPoint)
- red-teaming (LLM jailbreak techniques)
- research (arXiv, blog monitoring, Polymarket, data forensics)
- smart-home (Philips Hue)
- social-media (X/Twitter)
- software-development (TDD, debugging, code review, plan writing)

Each skill ported must:
- Have valid SKILL.md with frontmatter
- Include trigger conditions
- Include numbered steps with exact commands
- Include pitfalls section
- Include verification steps
- Pass syntax validation

### Week 14-15: Domain pack system

Folder-based pack architecture:
```
domain-packs/
  property-uk/          ← Reference implementation
    prompts/            ← Domain-specific prompts
    tools/              ← Domain-specific tools
    models/             ← Fine-tuned model configs
    data/               ← Static data (regulations, rates)
    SKILL.md            ← Pack manifest
  template/             ← Copy this to start a new pack
    prompts/
    tools/
    models/
    data/
    SKILL.md
```

Create documentation:
- How to create a domain pack
- Pack manifest specification
- Tool registration inside a pack
- Model configuration for domain-specific fine-tuning
- Testing a pack
- Publishing a pack

Test: Create a "restaurant-uk" pack from scratch using only the documentation. It must work without code changes to Carina Core.

### Week 16: Tool registration API

Plugin interface for custom tools:
- Tool manifest format (name, parameters, description, handler)
- Hot-reload: add a tool file, Carina detects and registers it
- Tool lifecycle: register → validate → execute → audit
- Tool sandboxing: each tool runs in isolated context
- Error handling: tool failure must not crash the agent

### Phase 3 deliverable
70+ skills available. Anyone can create a domain pack for any industry. Tools are hot-reloadable without restart.

---

## PHASE 4: OPENCLAW FEATURES
**Duration: 4 weeks**
**Ship: Workspace intelligence + heartbeat**

### Week 17-18: Workspace system

Port OpenClaw workspace features:

- AGENTS.md auto-loading from current working directory
  - Carina checks for AGENTS.md in cwd on session start
  - Loads it as system context before first prompt
- SOUL.md; Agent personality definition
  - Loaded at session start
  - Defines tone, style, constraints
- IDENTITY.md; Agent identity and role
- USER.md; User preferences and profile
- TOOLS.md; Tool-specific configuration and notes
- BOOTSTRAP.md; First-run self-configuration
  - Carina reads this on first run in a new workspace
  - Self-configures based on instructions
  - Deletes BOOTSTRAP.md after successful bootstrap
- Daily memory files (memory/YYYY-MM-DD.md)
  - Raw logs of what happened each day
  - Created automatically at end of session
- MEMORY.md; Curated long-term memory
  - Agent reviews daily files and updates MEMORY.md
  - Contains distilled learnings, not raw logs

### Week 19: Heartbeat system

- Heartbeat polling (~every 30 minutes)
  - Configurable interval
  - Skips during quiet hours (23:00-08:00 unless urgent)
- Proactive checks (from HEARTBEAT.md checklist)
  - Email inbox (unread messages)
  - Calendar (upcoming events in 24-48h)
  - Social mentions (X/Twitter)
  - Weather (if relevant)
- Heartbeat state tracking
  - Last check timestamps per category
  - Persisted between sessions
- Memory maintenance during heartbeats
  - Review recent daily files
  - Update MEMORY.md with distilled insights
  - Remove outdated information

### Week 20: Group chat intelligence

- Platform awareness
  - Know which platform a message came from
  - Adapt formatting: no tables on WhatsApp, suppress link embeds on Discord
- Speaking rules
  - Respond when directly mentioned or asked
  - Respond when adding genuine value
  - Stay silent during casual banter between humans
  - Avoid triple-tapping (multiple responses to same message)
- Reaction system
  - Emoji reactions on Discord/Slack
  - Lightweight social signals
  - One reaction per message max

### Phase 4 deliverable
Carina works as a personal workspace agent. Checks in proactively. Knows when to speak and when to be quiet. Has daily memory journaling.

---

## PHASE 5: ADVANCED FEATURES
**Duration: 8 weeks**
**Ship: Local models, cross-agent, marketplace**

### Week 21-22: Model routing

- Ollama integration
  - Bundled Ollama binary or system Ollama detection
  - Model download and management via Ollama CLI
  - Hot-swap between local and cloud models
- Task classifier
  - Automatic routing based on task type
  - Simple queries → local model (fast, free)
  - Complex reasoning → cloud model (capable)
  - Property-specific → fine-tuned local model
- Cost tracking
  - Per-model token usage
  - Per-task cost estimation
  - Usage dashboard in admin panel
- Provider switching
  - Mid-conversation model switching
  - Fallback chain: local → cloud primary → cloud backup
  - Graceful degradation when offline

### Week 23-24: Cross-agent collaboration

- Shared knowledge protocol
  - Hermes, OpenClaw, and Carina share memory
  - Unified memory namespace
  - 5-minute sync cycle between agents
- Task handoff
  - "Hermes, deploy this." "Carina, monitor it."
  - Task routing based on agent strengths
  - Status tracking across agents
- Agent discovery
  - Auto-detect other agents on the system
  - Register capabilities
  - Negotiate task assignment

### Week 25-26: Scout dashboard 2.0

- Real-time agent monitoring
  - All active agents visible on one dashboard
  - Session status, tool usage, token consumption
  - Threat level indicators per agent
- Alerting
  - Configurable severity thresholds
  - Multi-channel alerts (Telegram, Discord, email, SMS)
  - Alert history and trend analysis
- Usage analytics
  - Tokens consumed per workspace per day
  - Tool usage frequency and patterns
  - Cost projection based on historical data
- Compliance reporting
  - Exportable audit reports
  - GDPR compliance verification
  - Custom report builder

### Week 27-28: Tool marketplace

- Public registry
  - Anyone can publish a tool
  - Versioned, with changelogs
  - Community ratings and reviews
- Private registry
  - Enterprise-only tools
  - Access control per workspace
  - Audit trail for tool installations
- Installation
  - One-click from marketplace
  - Dependency resolution
  - Automatic compatibility checking
- Publishing
  - Tool manifest validation
  - Automated testing before publish
  - Documentation generation from manifest

### Phase 5 deliverable
Carina runs local models, collaborates with other agents, has enterprise monitoring, and a community tool marketplace.

---

## TIMELINE SUMMARY

| Phase | Weeks | What ships |
|---|---|---|
| 1: Property + Security | 1-5 | Working property agent with Scout |
| 2: Power Tools | 6-11 | Full Hermes tool parity (40+ tools) |
| 3: Skill Ecosystem | 12-16 | 70+ skills + domain pack system |
| 4: OpenClaw Features | 17-20 | Workspace intelligence + heartbeat |
| 5: Advanced | 21-28 | Local models, cross-agent, marketplace |

Total: 28 weeks. Ship every 4-6 weeks.

## What can run in parallel

- Phase 2 (tools) + Phase 3 (skills) can overlap; different code areas
- Phase 4 (workspace) can start during Phase 3
- Scout improvements can run alongside any phase
