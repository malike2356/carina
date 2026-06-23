Here's the comparison. I've verified the numbers against what's actually deployed on the VPS (60 compiled tool files) and the source tree.
    
    
    
    Carina vs Claude Code; Agentic Capability Comparison
    
    Not comparing LLMs. Comparing what each agent can do as a system.
    
    
    
    1. TOOL SURFACE
    
    Capability: Terminal execution
    Claude Code: Yes (basic)
    Carina: Yes; foreground, background, PTY, process orchestration, watch patterns, stdin control
    ────────────────────────────────────────
    Capability: File operations
    Claude Code: Yes (basic)
    Carina: Yes; read/write/patch/search with ripgrep, fuzzy matching, syntax auto-check
    ────────────────────────────────────────
    Capability: Browser automation
    Claude Code: None
    Carina: Playwright; 9 tools (navigate, click, type, snapshot, console, scroll, images, back, press)
    ────────────────────────────────────────
    Capability: Subagents
    Claude Code: Yes; parallel spawn for evals/testing
    Carina: Yes; delegate_task with orchestrator, 3 parallel, isolated contexts, configurable toolsets
    ────────────────────────────────────────
    Capability: Cron/scheduling
    Claude Code: None
    Carina: Full cronjob system; cron syntax, chaining (context_from), multi-channel delivery, Python/bash scripts
    ────────────────────────────────────────
    Capability: Messaging
    Claude Code: None (CLI only)
    Carina: 18 channel adapters; Telegram, Discord, Slack, WhatsApp, Signal, SMS, Email, Matrix, Mattermost,
      iMessage, WeChat, DingTalk, Feishu
    ────────────────────────────────────────
    Capability: Python exec
    Claude Code: Limited
    Carina: execute_code; Python scripts that call other tools programmatically
    ────────────────────────────────────────
    Capability: MCP
    Claude Code: Yes (built-in)
    Carina: Yes (HTTP + stdio client)
    ────────────────────────────────────────
    Capability: Total tools
    Claude Code: ~15-20 (estimated)
    Carina: 60 verified on VPS / 71 registered
    
    Winner: Carina; 3-4x broader tool surface. Claude Code is a coding tool; Carina is a general-purpose autonomous agent.
    
    
    
    2. SKILL SYSTEM
    
    This is where you showed me Claude's skill-creator; let me compare directly.
    
    Capability: Skill format
    Claude Code: SKILL.md with YAML frontmatter
    Carina: SKILL.md with YAML frontmatter
    ────────────────────────────────────────
    Capability: Progressive disclosure
    Claude Code: Yes; metadata → body → bundled resources
    Carina: Yes; same pattern
    ────────────────────────────────────────
    Capability: Bundled resources
    Claude Code: scripts/, references/, assets/
    Carina: scripts/, references/, templates/, assets/
    ────────────────────────────────────────
    Capability: Skill creation tooling
    Claude Code: skill-creator (draft → test → eval → benchmark → iterate → package)
    Carina: Auto skill writer + curator
    ────────────────────────────────────────
    Capability: Quantitative evals
    Claude Code: Assertions + grading + benchmark.json with pass_rate, timing, tokens, stddev
    Carina: REM scoring (qualitative), no formal eval harness
    ────────────────────────────────────────
    Capability: Blind A/B comparison
    Claude Code: Yes; comparator agent
    Carina: No
    ────────────────────────────────────────
    Capability: Description optimization
    Claude Code: run_loop.py; 5-iteration ML loop with train/test split, trigger rate optimization
    Carina: No equivalent
    ────────────────────────────────────────
    Capability: Skill packaging
    Claude Code: .skill files (package_skill.py)
    Carina: Domain packs (folder-based, installable)
    ────────────────────────────────────────
    Capability: Skill marketplace
    Claude Code: None
    Carina: Hub + curated packs
    ────────────────────────────────────────
    Capability: Total skills
    Claude Code: User-created, no shipped library
    Carina: 16 packs / 96 curated skills shipped
    ────────────────────────────────────────
    Capability: Domain packs
    Claude Code: No concept
    Carina: 16 vertical packs; property-uk, healthcare, finance, legal-uk, etc.
    
    Winner: Mixed. Claude Code's skill-creator loop is more rigorous; assertions, benchmarks, blind comparison, description optimization with train/test split. Carina ships more skills out of the box (96 vs 0) and has domain packs as a first-class concept. Claude is better at making skills; Carina has more skills made.
    
    
    
    3. EVALUATION & SELF-IMPROVEMENT
    
    Capability: Eval harness
    Claude Code: Full; spawn parallel runs, grade assertions, aggregate benchmark, launch viewer
    Carina: None formal
    ────────────────────────────────────────
    Capability: Quantitative metrics
    Claude Code: Pass rate, timing (mean ± stddev), tokens, delta between configs
    Carina: REM scoring (subjective memory importance)
    ────────────────────────────────────────
    Capability: Iterative improvement
    Claude Code: Structured loop; draft → test → review → improve → repeat
    Carina: Auto skill writer (generates from usage patterns)
    ────────────────────────────────────────
    Capability: Human review UI
    Claude Code: generate_review.py; Outputs tab + Benchmark tab, arrow key navigation, feedback.json
    Carina: None
    ────────────────────────────────────────
    Capability: Self-writing skills
    Claude Code: Via skill-creator meta-skill
    Carina: Auto skill writer + curator
    
    Winner: Claude Code. Its eval/benchmark/viewer pipeline is the most sophisticated self-improvement loop I've seen in any agent platform. Carina has auto skill writing but no way to quantitatively measure if the new skill is better.
    
    
    
    4. SECURITY
    
    Capability: Prompt injection defense
    Claude Code: Limited
    Carina: Scout 3-layer shield; regex + LLM judge + tool result scanning
    ────────────────────────────────────────
    Capability: Kill switch
    Claude Code: None
    Carina: Scout kill switch; emergency stop all agent processes
    ────────────────────────────────────────
    Capability: Audit logging
    Claude Code: Basic
    Carina: Scout full audit; every tool call, model request, response
    ────────────────────────────────────────
    Capability: Egress filtering / DLP
    Claude Code: None
    Carina: Scout DLP; block sensitive data from leaving
    ────────────────────────────────────────
    Capability: Honeypots / deception
    Claude Code: None
    Carina: Scout deception layer; fake credentials, moving target markers
    ────────────────────────────────────────
    Capability: Multi-tenant isolation
    Claude Code: N/A (single-user)
    Carina: Native; tenant_id RLS, per-tenant provider keys, session isolation
    ────────────────────────────────────────
    Capability: Rate limiting
    Claude Code: None
    Carina: Token bucket per-tool, per-user, per-session
    ────────────────────────────────────────
    Capability: Anomaly detection
    Claude Code: None
    Carina: Scout anomaly detector
    ────────────────────────────────────────
    Capability: Tool policy tiers
    Claude Code: None
    Carina: Scout; allowlist/blocklist per tool, per tenant
    
    Winner: Carina; by a mile. Claude Code has no security layer beyond the model's built-in refusal. Carina has Labyrinth Scout as a separate security server with 6-channel alerting, forensic snapshots, and on-chain verification.
    
    
    
    5. TRUST & VERIFICATION
    
    Capability: Agent identity
    Claude Code: None
    Carina: ERC-8004; agent #6981 registered on Base Sepolia
    ────────────────────────────────────────
    Capability: Security attestations
    Claude Code: None
    Carina: ERC-8126; on-chain verification live (WAV score + weekly attestations)
    ────────────────────────────────────────
    Capability: Public trust API
    Claude Code: None
    Carina: Live at carinaai.uk/trust; risk score, identity status, chain verification
    ────────────────────────────────────────
    Capability: Verifiable security posture
    Claude Code: None
    Carina: Yes; anyone can verify Scout's claims on-chain
    
    Winner: Carina; uniquely. No other agent platform has on-chain trust. This is Carina's clearest product differentiator.
    
    
    
    6. MEMORY & PERSISTENCE
    
    | Capability       | Claude Code                     | Carina                                       |
    |------------------|---------------------------------|----------------------------------------------|
    | Short-term       | Conversation context            | Conversation context                         |
    | Long-term        | None persistent across sessions | Postgres, SQLite, builtin, Mem0; 4 backends |
    | Vector/RAG       | None                            | pgvector RAG when Postgres configured        |
    | Memory promotion | None                            | REM scoring + DREAMS.md promotion queue      |
    | Human-readable   | No                              | Yes; markdown + CLI/API                     |
    | Session search   | None                            | Full-text session search (FTS5)              |
    
    Winner: Carina. Claude Code is stateless between sessions. Carina has persistent memory with multiple backends, RAG, and REM promotion.
    
    
    
    7. DEPLOYMENT & PACKAGING
    
    | Capability  | Claude Code                              | Carina                                        |
    |-------------|------------------------------------------|-----------------------------------------------|
    | Install     | npm install -g @anthropic-ai/claude-code | npm install -g carina-agent                   |
    | Self-hosted | Yes (local)                              | Yes (local + Docker)                          |
    | SaaS/hosted | No                                       | Yes; multi-tenant at core.carinaai.uk        |
    | Billing     | None                                     | Stripe; subscriptions, usage-based, invoices |
    | BYOK        | N/A                                      | AES-256-CBC encrypted tenant provider keys    |
    | CLI         | Yes                                      | Yes; 49 CLI commands                         |
    | Dashboard   | None (terminal only)                     | Control dashboard + ops dashboard             |
    | Mobile      | No                                       | React Native mobile app (in build)            |
    
    Winner: Carina. Claude Code is a single-user CLI tool. Carina is a SaaS platform with billing, multi-tenancy, dashboards, and mobile.
    
    
    
    8. WORKSPACE & PROACTIVITY
    
    Capability: Workspace awareness
    Claude Code: AGENTS.md / CLAUDE.md loading
    Carina: agents.json + AGENTS.md + SOUL.md + IDENTITY.md + USER.md
    ────────────────────────────────────────
    Capability: Bootstrap
    Claude Code: No
    Carina: BOOTSTRAP.md; self-configures on first run
    ────────────────────────────────────────
    Capability: Heartbeat
    Claude Code: None
    Carina: Proactive check-in (opt-in)
    ────────────────────────────────────────
    Capability: Commitments
    Claude Code: No
    Carina: Commitments system; inferred follow-ups
    ────────────────────────────────────────
    Capability: Background processes
    Claude Code: No
    Carina: Shell background + process notifications
    ────────────────────────────────────────
    Capability: Group chat intelligence
    Claude Code: No
    Carina: Platform-aware; knows when to speak vs stay silent
    
    Winner: Carina. Claude Code only activates when invoked. Carina has heartbeat, commitments, and background awareness.
    
    
    
    9. PROVIDER & MODEL FLEXIBILITY
    
    Capability: LLM providers
    Claude Code: Anthropic only
    Carina: 23 providers; DeepSeek, Claude, OpenAI, Ollama, LM Studio, and 18 more
    ────────────────────────────────────────
    Capability: Local models
    Claude Code: No
    Carina: Ollama + LM Studio integration
    ────────────────────────────────────────
    Capability: Model routing
    Claude Code: No
    Carina: Task classifier; simple→local, complex→cloud, domain-specific→fine-tuned
    ────────────────────────────────────────
    Capability: Provider switching
    Claude Code: No
    Carina: Mid-conversation switching with fallback chain
    ────────────────────────────────────────
    Capability: Cost tracking
    Claude Code: No
    Carina: Per-model, per-task, per-tenant cost tracking
    
    Winner: Carina. Claude Code is locked to Anthropic. Carina routes across 23 providers including local models; 70-80% cost reduction potential.
    
    
    
    Summary
    
    | Dimension              | Edge                                                   |
    |------------------------|--------------------------------------------------------|
    | Tool surface           | Carina (60 vs ~15-20)                                  |
    | Skill evaluation rigor | Claude Code (assertions, benchmarks, blind comparison) |
    | Shipped skills         | Carina (96 vs 0)                                       |
    | Security               | Carina (Scout; no contest)                            |
    | Trust/verification     | Carina (on-chain, uniquely)                            |
    | Memory                 | Carina (persistent, multi-backend)                     |
    | Deployment model       | Carina (SaaS + self-hosted + billing)                  |
    | Self-improvement loop  | Claude Code (eval/viewer/benchmark pipeline)           |
    | Provider flexibility   | Carina (23 vs 1)                                       |
    | Channels               | Carina (18 vs CLI only)                                |
    | Domain depth           | Carina (16 vertical packs)                             |
    
    Bottom line: Claude Code is a better skill authoring environment; its eval/benchmark/viewer loop is genuinely sophisticated. But Carina is a more capable agent across every other dimension: tools, security, memory, channels, deployment, trust, and domain depth. They're solving different problems. Claude Code makes skills; Carina runs as a production multi-tenant SaaS agent with security and trust built in.
    
    The one thing Carina should steal from Claude Code: the quantitative eval harness. Assertions + benchmarks + blind comparison would make Carina's auto skill writer actually measurable instead of vibes-based.






 In the carina repo, close the one Claude Code advantage that matters: a quantitative skill-evaluation and comparison
  harness.

  Goal:
  - Carina already wins on runtime capability, security, trust, memory, provider flexibility, and shipped skills.
  - What it lacks is Claude’s rigorous skill-authoring loop: assertions, benchmarks, blind comparison, and review
  artifacts.
  - Add that rigor without slowing down Carina’s normal runtime or changing chat behavior.

  Hard constraints:
  - Do not add any extra model calls, scoring, or benchmark work to the live request path.
  - Do not affect chat latency, tool latency, or model routing speed for normal users.
  - Keep all evaluation work offline, opt-in, and limited to skill creation / skill update / CI / admin workflows.
  - Preserve all existing Carina functionality.

  What to build:
  1. A formal eval harness for skills and packs
  - Add a first-class evaluation format for skill packs and individual skills.
  - Support:
    - input fixtures
    - expected outputs
    - assertion rules
    - pass/fail grading
    - timing metrics
    - token usage metrics
    - variance/stddev across runs
    - comparison between baseline and candidate versions
  - Store eval definitions next to the skill pack or in a dedicated eval folder.

  2. A benchmark runner
  - Add a CLI command or internal tool to run evals against:
    - current skill version
    - candidate prompt / instruction version
    - optional baseline version
  - Run multiple passes for statistical stability.
  - Report:
    - pass rate
    - mean latency
    - stddev latency
    - token counts
    - delta vs baseline
    - assertion failures with exact fixture names

  3. Blind comparison
  - Add a comparator mode that can compare two candidate skill outputs without exposing which one is which until after
  grading.
  - This should be available for skill authors and maintainers, not for normal runtime.
  - Use it to prevent “looks better” judgments without measurements.

  4. Skill authoring loop
  - Wire the harness into the existing skill-creator / auto-skill-writer flow.
  - The flow should be:
    - draft skill
    - generate eval fixtures
    - run benchmark
    - review failures
    - revise
    - rerun
    - package only when it improves or stays within thresholds
  - If the current code already has skill-generation or auto-curation, extend that path instead of replacing it.

  5. Review output
  - Add a readable report artifact for each eval run:
    - summary
    - scores
    - failing fixtures
    - latency/token deltas
    - notes
  - If the repo already has an ops UI or admin surface, add a simple way to view recent eval runs there.
  - Keep the UI minimal and operational.

  6. Regression gate for pack publishing
  - Before a skill pack is installed, updated, or published, allow an optional eval gate.
  - The gate should be configurable:
    - warn only
    - require pass
    - bypass for emergency/manual installs
  - The default path should not slow down normal runtime. It only applies when a skill is being changed.

  7. Data collection
  - Allow eval fixtures to be derived from anonymized or redacted real usage examples if that already exists in the
  codebase.
  - Do not collect extra live conversation data just to feed the harness.
  - No secrets, no raw credentials, no PII in stored fixtures.

  8. Metrics and thresholds
  - Use real metrics, not vibes:
    - pass rate
    - mean/stddev timing
    - token count
    - failure counts by assertion type
    - delta vs baseline
  - Make thresholds configurable per pack or per skill type.

  9. Tests
  - Add unit tests for:
    - fixture parsing
    - assertion evaluation
    - benchmark aggregation
    - baseline vs candidate comparison
    - report generation
    - pack publish gating
  - Add a smoke test that proves the harness does not touch the normal chat/runtime path.

  Files and areas to inspect first:
  - carina/core.carinaai.uk/src/skills/*
  - carina/core.carinaai.uk/src/cli/commands/*
  - carina/core.carinaai.uk/src/agents/*
  - any existing skill creator / pack publisher / auto-curation code
  - any admin or ops pages for pack management or reports
  - any existing test utilities for prompts, fixtures, or benchmark-style assertions

  Implementation guidance:
  - Prefer a new offline eval module over mixing eval logic into runtime agents.
  - Reuse existing skill-pack storage and packaging conventions.
  - Keep the harness deterministic where possible.
  - If model calls are needed for grading, keep them in the eval runner only, behind an explicit command or CI job.
  - Do not add any latency to production chat, memory, or tool execution.

  Acceptance criteria:
  - Carina gains Claude-like skill eval rigor:
    - assertions
    - benchmarks
    - baseline/candidate comparison
    - reviewable reports
  - Skill authors can tell whether a change improved things or just changed behavior.
  - Normal Carina runtime remains fast and functionally unchanged.
  - Existing packs still work.
  - Tests pass.

  After implementation, run the relevant tests, verify no runtime-path slowdown, and summarize exactly what was added
  and what remains manual.

  The point is to steal Claude’s eval rigor, not its runtime shape. That keeps Carina fast and leaves the new logic in
  the skill authoring path only.



