# Carina Self-Knowledge and Self-Improvement

## What Self-Knowledge Means for Carina

Carina is aware of its own capabilities, architecture, and operational context at runtime.
This self-knowledge is not simulated or prompted from scratch each session. It is structured
data injected into every agent turn from verified sources: the platform knowledge file, the
RAG system, and the SOP corpus. When Carina answers a question about itself, it draws from
these sources rather than from training data that may be outdated or inaccurate.

The self-knowledge system has three layers, each with a different purpose and update frequency.

## Layer 1: Platform Knowledge Injection (Every Turn)

**Files:** `src/platform/platform-knowledge.md` and `src/platform/platform-state.md`

**Loaded:** Once at server startup via `preloadPlatformKnowledge()`, cached in memory, injected
via `buildPlatformKnowledgeContext()` into every agent turn as system context.

**Update frequency:** Manually by the operator when the platform changes significantly. These
are authoritative runtime facts.

**Contents of platform-knowledge.md:**
- Monorepo structure and purpose of each directory
- What each backend service is and whether it is shipped
- What each frontend application is and its tech stack
- Active projects and their current status
- Deploy scripts location and naming
- Product naming and scope boundaries (what is Carina vs Aiva vs Scout)

**Contents of platform-state.md:**
- Current active development focus
- Which features are in progress vs complete
- Operator notes about the current state of the system

**Why this matters:** Every agent session starts with accurate structural knowledge about the
platform. Carina cannot confuse Aiva with Scout, cannot mix up which backend serves which
product, and cannot recommend features that do not exist.

## Layer 2: RAG Knowledge Corpus (Semantic Retrieval)

**Directory:** `01-devends/RAG/`

**Ingested via:** `carina ingest --pack <packname>` or direct `insertRagChunk()` calls.

**Retrieved via:** `searchRag(query, limit)` at query time using pgvector cosine similarity.

**Update frequency:** When new knowledge documents are written or existing ones are updated
and re-ingested.

**Contents (this directory):**
- RAG-001: Identity and purpose
- RAG-002: Architecture overview
- RAG-003: Tools and capabilities (complete verified list)
- RAG-004: Skill packs (all 23 packs)
- RAG-005: Channel adapters (all 8 built)
- RAG-006: Memory and RAG system
- RAG-007: Scout governance
- RAG-008: Aiva AI employee
- RAG-009: AI providers and model routing
- RAG-010: Business model and platform
- RAG-011: API surface and routes
- RAG-012: This document (self-knowledge and self-improvement)

**Why RAG over full context injection:** The platform-knowledge file is small and static enough
to inject on every turn. The full technical knowledge corpus (12 documents, thousands of words)
would consume too many tokens on every turn. RAG retrieves only the relevant documents for the
current query, keeping context window usage efficient.

## Layer 3: SOP Corpus (Operational Procedures)

**Directory:** `01-devends/SOP/`

**Contents (20 verified SOPs):**
- 001: Platform architecture and operations
- 002: Deployment guide
- 003: Internal architecture
- 004: User management and access
- 005: Dev environment setup
- 006: Launch runbook
- 007: Aiva pilot onboarding
- 008: Background process management
- 009: Cron workflows
- 010: Webhooks
- 011: Operator TUI
- 012: Profile isolation
- 013: Brain sync Propreneur to Carina
- 014: Carina Propreneur operator guide
- 015: Carina Propreneur convergence
- 016: Security configuration
- 017: Security hardening checklist
- 018: Security incident SLA
- 019: n8n social automation
- 020: Tenant isolation

SOPs describe how to operate the platform, not what the platform is. They are operational
runbooks for the human operator and for Carina when it assists the operator with platform
management tasks.

## Self-Improvement Mechanisms

### Skill Auto-Writing

The `skill-curator-tool.ts` gives Carina the ability to write new skill packs autonomously.
When Carina completes a novel multi-step task, it can be instructed (or autonomously choose)
to:
1. Identify the generalizable pattern in what it just did
2. Write a SKILL.md manifest with the steps, trigger conditions, pitfalls, and verification
3. Save it to the appropriate skill pack directory
4. The skill is available on the next session without a restart

This is the self-improvement loop that is the primary differentiator from static AI assistants.
Carina encodes successful procedures as reusable skills, so it gets better at specific tasks
the more it does them.

### REM (Random-access Episodic Memory) Promotion

The REM system promotes valuable episodic memories to the long-term curated store:
1. Session memories accumulate in the episodic store
2. `rem-scorer.ts` runs periodically and scores each memory by quality and relevance
3. High-scoring memories are queued in `DREAMS.md` by `rem-promotion.ts`
4. The agent reviews the promotion queue and incorporates valuable memories into `MEMORY.md`
5. Old episodic memories are periodically consolidated and low-value ones are pruned

This mimics the cognitive science distinction between episodic memory (what happened) and
semantic memory (what is generally true). REM is the process that converts one into the other.

### Session Search for Self-Reference

The `session-search` tool gives Carina access to its full conversation history across all
sessions. When a user asks "what did we decide about X last month?", Carina searches the
episodic record and retrieves the relevant context. This prevents the common failure mode of
AI assistants where every session starts from zero.

### Aiva Worker Knowledge Base Growth

Each Aiva worker's knowledge base grows as the operator adds documents and FAQ pairs through
the Aiva management interface. The worker becomes more knowledgeable about the specific business
it serves over time. This is a manual process currently (operator uploads knowledge), but the
architecture supports automated extraction: the email ingestion pipeline can identify recurring
questions and flag them for addition to the FAQ.

## Knowledge Update Workflow

When the platform changes significantly (a new feature ships, a product is renamed, a new
integration is added), the update workflow is:

1. Update `src/platform/platform-knowledge.md` with the structural change
2. Update `src/platform/platform-state.md` with the current operational state
3. If the change warrants a RAG document update: update the relevant RAG-0XX file in
   `01-devends/RAG/`
4. Run `carina ingest --pack rag-training` (once the RAG upload module is built) to re-ingest
   changed chunks
5. The agent will reflect the updated knowledge on the next session

The RAG ingestion is idempotent by source path: `isSourceIngested(source)` prevents duplicate
ingestion. To force re-ingestion of an updated file, delete the existing `rag_chunks` rows
for that source path, then re-ingest.

## What Carina Should Know About Itself

When a user asks Carina about its own capabilities, Carina should be able to accurately answer:

- Which tools are available and what each one does
- Which channels it can communicate through
- Which AI providers it supports and what each is good at
- How its memory system works (session, persistent, RAG, REM)
- What skill packs are installed and what each covers
- What Scout does and how it protects the agent
- What Aiva is and how it differs from the Carina platform
- What the business model is (for context on why certain architectural decisions were made)
- How to deploy and operate the platform (from SOP knowledge)
- What is currently being built and what the next milestone is

If Carina cannot answer any of the above accurately, the corresponding knowledge document
needs to be updated and re-ingested.
