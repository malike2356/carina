# Carina Skill Packs

## What Skill Packs Are

A skill pack is a named collection of pre-built workflows, prompts, and knowledge that Carina can
invoke. Skills are different from tools: a tool is a single callable function (run a shell command,
search the web, send an email). A skill is a multi-step procedure with trigger conditions,
step-by-step instructions, pitfall warnings, and verification steps.

Skills are authored as markdown files with a `SKILL.md` manifest. The manifest includes:
- Frontmatter: name, description, category, trigger conditions
- Numbered steps with exact commands or instructions
- Pitfalls section
- Verification steps to confirm the skill completed successfully

Skills can call tools. A skill is essentially a reusable playbook that teaches Carina how to
perform a complex, recurring workflow correctly every time.

## Location in the Codebase

- Pack directories: `core.carinaai.uk/src/skills/packs/`
- Pack loading: `core.carinaai.uk/src/skills/index.ts`
- Self-improvement: `core.carinaai.uk/src/skills/skill-curator-tool.ts` (auto-writes skills)
- Ingestion: `core.carinaai.uk/src/skills/ingestion.ts` (embeds skills into pgvector RAG)
- Brain knowledge: `core.carinaai.uk/src/skills/brain-knowledge-skills.ts`

## The 23 Skill Packs (Verified)

Each pack name is the directory name under `src/skills/packs/`.

### automation
Workflow automation, task chaining, scheduled processes, n8n integration, trigger-action patterns,
batch processing, and multi-step workflow design.

### borehole-africa
Domain-specific knowledge for borehole drilling and water infrastructure in Africa. Covers
site assessment, drilling specifications, water quality testing, community water point management,
and sector terminology relevant to the VERLOX ABBIS project.

### capabilities-ops
Internal operational skills for managing Carina's own capabilities: tool registration, skill
creation workflow, capability testing, feature flag management, and operator utility patterns.

### cms-ops
Content management system operations: content publishing workflows, media management, category
structuring, SEO metadata, content scheduling, and multi-channel distribution.

### core-engineering
Software engineering workflows: code review procedures, debugging patterns, architecture decision
records, pull request creation, test writing, dependency management, and technical documentation.

### creative-basics
Creative content generation: copywriting frameworks, tone adaptation, headline writing, story
structure, content briefs, brand voice application, and creative brief interpretation.

### data-science
Data analysis workflows: dataset exploration, statistical summary, chart and visualization
generation, hypothesis testing, data cleaning patterns, and reporting templates. Includes R, PSPP,
Jamovi, and Python-based analysis paths.

### devops
Infrastructure and deployment operations: Docker management, server health checks, log analysis,
CI/CD pipeline management, environment configuration, container monitoring, and incident response.

### email-extended
Advanced email workflows beyond basic send/receive: inbox zero procedures, email triage rules,
thread summarization, automated response drafting, follow-up scheduling, and bulk email management.

### finance
Financial analysis and reporting: expense categorization, invoice processing, cashflow
summarization, budget vs actual comparison, P&L reading, and financial document extraction.

### legal-uk
UK legal reference and document workflows: contract clause identification, compliance checks
against UK law, GDPR documentation, Companies House filing guidance, tenancy agreement review,
and legal terminology explanation. Not a substitute for legal advice; for reference only.

### marketing-ops
Marketing operations: campaign brief creation, audience segmentation, ad copy generation,
social media scheduling, performance report interpretation, and content calendar management.

### media-extended
Extended media handling: podcast script creation, video concept development, audio production
notes, image prompt engineering, thumbnail brief writing, and media asset organization.

### meeting-ops
Meeting management: agenda creation, meeting note summarization, action item extraction, follow-up
email drafting, calendar coordination, and meeting effectiveness review.

### mlops
Machine learning operations: model evaluation, experiment tracking, dataset versioning, model
deployment checklist, hyperparameter documentation, and ML pipeline health monitoring.

### operator-daily
Daily operational routines for Carina operators: morning briefing structure, task review, system
health check procedure, end-of-day summary, and operator handoff documentation.

### productivity
General productivity workflows: task prioritization, GTD-style inbox processing, project status
updates, weekly review procedure, focus block scheduling, and decision logging.

### recruitment
Hiring process workflows: job description writing, candidate screening criteria, interview
question design, feedback documentation, offer letter drafting, and onboarding checklist creation.

### research-basics
Research workflows: source evaluation, literature review structure, citation management, research
brief writing, competitive analysis framework, and report structure templates.

### sales-crm
Sales process workflows: lead qualification, discovery call preparation, proposal structure,
follow-up cadence, objection handling frameworks, CRM update discipline, and pipeline review.

### smart-home
Home automation workflows: Home Assistant integration, device grouping, automation trigger
patterns, scene configuration, energy monitoring, and device troubleshooting.

### social-extended
Social media management: platform-specific formatting rules (LinkedIn vs X vs Instagram),
content scheduling, engagement monitoring, comment response guidelines, and analytics
interpretation.

### template
A skeleton pack for creating new packs. Contains the required file structure, SKILL.md frontmatter
format, example trigger conditions, step format, and the pitfalls/verification sections.
Copy this directory to start a new pack.

## Skill Ingestion Into RAG

When `carina ingest --pack <packname>` is run, the ingestion pipeline:
1. Reads all `.md` files from the pack's `knowledge/` subdirectory
2. Chunks each file at heading boundaries, targeting 2,000 characters per chunk
3. Generates embeddings via the active embedding provider (Gemini, Voyage, or OpenAI)
4. Stores each chunk in `rag_chunks` table with `source` (file path), `pack` (pack name), `content`, and `embedding` (pgvector)

During agent turns, `searchRag(query, limit)` retrieves the most relevant chunks via cosine
similarity (`<=>` operator on pgvector) and injects them into the agent's context.

## Skill Auto-Writing

The `skill-curator-tool.ts` gives Carina the ability to write new skills autonomously. When Carina
successfully completes a complex multi-step task it has not seen before, it can create a new skill
capturing the steps, so the next time that task is requested it executes from the verified
procedure rather than reasoning from scratch.

This is the self-improvement loop: Carina learns from what it does and encodes that learning as a
reusable skill.

## Brain Knowledge Integration

`brain-knowledge-skills.ts` and `brain-knowledge-meta.ts` manage the integration between the
skill pack system and the agent's context window. Skills are not loaded in full into every turn;
instead, the skill curator selects the most relevant skills for the current task using embeddings,
and injects only those.
