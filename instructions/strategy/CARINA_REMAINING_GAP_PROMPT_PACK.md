# Carina Remaining Gap Prompt Pack

Use this pack to close the remaining product and platform gaps called out by `CARINA_CATEGORY.md` and the merged capability checklist.

Suggested order:
1. Self-improvement loop productionization
2. Cookbook and deep research
3. Multi-agent routing and cross-agent learning
4. Tool, skill, and channel expansion
5. Hub marketplace and ecosystem
6. Security, Scout, and critical-event attestation
7. Ops and control-plane parity
8. Provider maturity and routing detail
9. Channels, node host, sandbox, approvals
10. TaskFlows, cron, kanban, and workflow execution
11. Memory, session lineage, and workspace isolation
12. Plugins, extensions, and utility tools
13. Observability, ACP, doctor, secrets, billing, tenancy, mobile, docs
14. Category-forming moat work

## 1. Self-improvement loop productionization

```text
You are working in the Carina core codebase. Ship the self-improvement loop to production and make it continuously improve on evidence, not recency.

Scope:
- Deploy the current learning loop to live runtime paths.
- Make corrections, review outcomes, and promote evidence-backed changes automatically.
- Archive unused or lower-quality skills instead of deleting them.
- Run curator and learning passes continuously, not on a slow manual cycle.
- Add guardrails so the loop cannot regress quality or overwrite good state with weak feedback.

Requirements:
- Add tests for correction capture, review, promotion, archive, and rollback.
- Persist a full audit trail of what changed and why.
- Make the loop safe for multi-session use and repeated corrections.
- Expose a clear operator view of pending corrections and accepted improvements.

Acceptance:
- The learning loop is live, stable, and measurable.
- Skill updates happen from evidence, not only recency.
- Nothing is silently overwritten without traceability.
```

## 2. Cookbook and deep research

```text
You are working in the Carina core codebase. Build the Cookbook and Deep Research as first-class features.

Scope:
- Cookbook: detect local hardware, estimate VRAM, recommend models, and offer one-click local serve guidance.
- Deep Research: run multi-step, cited research with search, source reading, synthesis, and output rendering.
- Support both local models and cloud APIs in the recommendation flow.
- Make research output persistent, shareable, and editable across sessions.

Requirements:
- Add hardware detection and model recommendation logic.
- Add a research planner that can dispatch search, read, verify, and synthesize steps.
- Render citations and source provenance in the UI and saved output.
- Add tests for low-VRAM, cloud-only, mixed, and no-suitable-model cases.

Acceptance:
- A user can answer what they can run here and get a reliable answer.
- A user can ask for research and get a cited multi-step report, not a single-shot summary.
```

## 3. Multi-agent routing and cross-agent learning

```text
You are working in the Carina core codebase. Add OpenClaw-style multi-agent routing, then go beyond it with shared learning.

Scope:
- Route different agent profiles per channel, contact, or group.
- Share learned skills and useful corrections across profiles when allowed.
- Keep profile behavior distinct while reusing validated improvements.
- Add deterministic rules for when a routed agent should handle a message versus hand off.

Requirements:
- Add tests for routing, handoff, profile selection, and shared-learning propagation.
- Make cross-profile learning explicit and auditable.
- Preserve isolation where the project or tenant boundary requires it.

Acceptance:
- Carina can behave like different agents on different surfaces.
- Useful learning spreads across the kernel without flattening profile identity.
```

## 4. Tool, skill, and channel expansion

```text
You are working in the Carina core codebase. Close the capability-count gap by adding real tools, skills, and channels that improve daily use.

Scope:
- Expand the tool surface toward 99+ useful tools.
- Expand the curated skill library toward 115+ with quality control.
- Expand channel breadth toward 50+ where it matters.
- Prioritize operator value over vanity count.

Requirements:
- Audit what is missing versus the current tool and skill catalog.
- Add only high-value tools and skills, with tests and clear metadata.
- Add or harden the next channel adapters and thread ownership rules.
- Expose discovery and health status in CLI and UI surfaces.

Acceptance:
- The tool, skill, and channel gaps are visibly narrowed with real utility.
- New capabilities are discoverable, tested, and consistent with existing patterns.
```

## 5. Hub marketplace and ecosystem

```text
You are working in the Carina core codebase. Turn Carina Hub into a real marketplace for everything the platform ships.

Scope:
- Domain packs, tools, channel adapters, workflows, themes, and MCP servers should all be discoverable and installable.
- Build a registry and install flow that works for local and hosted use.
- Support featured, verified, and community-published entries.
- Add trust and validation metadata to each entry.

Requirements:
- Reuse the current pack and extension registries where possible.
- Add browse, install, enable, disable, update, and remove flows.
- Add tests for catalog integrity, install flow, and metadata validation.

Acceptance:
- Hub is a real ecosystem surface, not just a pack list.
- Users can find, install, and trust what they add.
```

## 6. Security, Scout, and critical-event attestation

```text
You are working across Carina and Scout. Close the remaining security moat gaps.

Scope:
- Wire sandbox policy into tool execution.
- Add automated attestation for critical events.
- Add role-based access controls for tools.
- Make operator and tenant security state visible and verifiable.
- Keep Scout as the trust layer, not a decorative add-on.

Requirements:
- Add tests for policy enforcement, attestation triggers, and role gating.
- Add audit events for security-sensitive transitions.
- Make trust verification available to the product surfaces that need it.
- Preserve honest reporting when a feature is partial or unavailable.

Acceptance:
- Security events are attested, not just logged.
- Tool access is role-aware and policy-aware.
- Scout and Carina cooperate cleanly at the trust boundary.
```

## 7. Ops and control-plane parity

```text
You are working in the Carina ops and core codebases. Close the remaining Claude Console style control-plane gaps.

Scope:
- Expand the AI platform surface for workbench, files, skills, batches, managed agents, sessions, deployments, environments, vaults, memory stores, analytics, and credits.
- Make the ops and customer surfaces feel like a durable product, not an internal dashboard.
- Use local persistence where upstream data is unavailable.

Requirements:
- Add or harden the routes, tables, and views needed for each missing control-plane surface.
- Add tests for schema bootstrap, persistence helpers, and route logic.
- Keep the UI compact, table-driven, and operational.
- Do not leave placeholder tabs that do nothing.

Acceptance:
- Carina Ops and the customer product cover the major control-plane surfaces expected from a real AI platform.
```

## 8. Provider maturity and routing detail

```text
You are working in the Carina core codebase. Close the remaining provider capability gaps.

Scope:
- Reasoning effort detection.
- Streaming compatibility matrix.
- Unified provider auth profile management.
- Voyage embeddings wired into retrieval and not just catalogued.

Requirements:
- Add provider capability detection and expose it in providers info.
- Add a documented streaming matrix.
- Add a real auth profile UI or CLI path for provider credentials.
- Wire embeddings into the RAG and memory path.

Acceptance:
- Provider handling is not just broad; it is mature and understandable.
```

## 9. Channels, node host, sandbox, approvals

```text
You are working in the Carina core codebase. Close the remaining channel, node host, sandbox, and approval gaps.

Scope:
- Finish IRC as a live client or keep it honestly stubbed with a clear contract.
- Make session DM scoping first-class where enabled.
- Add node-to-gateway WebSocket transport.
- Add container mode for node host.
- Add device RBAC and phone control.
- Add OpenShell sandbox backend, per-agent sandbox config, and stronger browser sandbox isolation.
- Add Unix socket approval daemon if it materially improves the current file-store approach.

Requirements:
- Add tests for transport, pairing, sandbox isolation, and approvals.
- Keep fallback behaviors explicit and safe.
- Do not claim support that is still only partial.

Acceptance:
- Channel, node, sandbox, and approval surfaces behave like finished product surfaces, not prototypes.
```

## 10. TaskFlows, cron, kanban, and workflow execution

```text
You are working in the Carina core codebase. Close the workflow orchestration gaps.

Scope:
- Per-job model overrides.
- Profile isolation per job.
- Job output history with search.
- TaskFlow DSL or YAML definitions.
- Sub-agent-triggered flows.
- Retry and resume from failed step.
- Enable-by-default once stable.
- Worker pool management.
- Task decomposition into kanban items.
- Parallel lane execution.
- Worker to orchestrator feedback loop.

Requirements:
- Add data persistence and execution state where needed.
- Add tests for flow creation, resume, retry, and worker orchestration.
- Keep the execution model understandable from the CLI and UI.

Acceptance:
- Carina can plan, run, retry, and inspect multi-step work reliably.
```

## 11. Memory, session lineage, and workspace isolation

```text
You are working in the Carina core codebase. Close the remaining memory and workspace gaps.

Scope:
- Cross-session semantic search.
- Session scrolling and lineage tracking.
- Separate user profile and agent memory stores.
- Workspace file watcher.
- Full OpenClaw workspace import path.
- Selective export.

Requirements:
- Add tests for lineage, search relevance, memory isolation, and workspace change detection.
- Keep memory stores bounded and auditable.
- Make import and export reliable, incremental, and explicit.

Acceptance:
- Memory is isolated where needed, searchable where useful, and traceable over time.
```

## 12. Plugins, extensions, and utility tools

```text
You are working in the Carina core codebase. Close the plugin ecosystem gaps.

Scope:
- Finish plugin store or registry behavior.
- Implement runtime MCP and hooks loaders for extension bundles.
- Add the missing utility plugins: Active Memory, Document Extraction, Web Readability, File Transfer, Phone Control, Bonjour Gateway Discovery, Tokenjuice, Memory Wiki, Skill Workshop, LLM Task.
- Improve skill validation and linting.
- Make marketplace install and browse flows robust.

Requirements:
- Add tests for extension loading, validation, and conflict handling.
- Keep runtime loading safe and opt-in.
- Preserve backward compatibility with existing registries.

Acceptance:
- Plugins are not just installable; they are actually useful, validated, and governed.
```

## 13. Observability, ACP, doctor, secrets, billing, tenancy, mobile, docs

```text
You are working across the Carina stack. Close the remaining platform quality gaps.

Scope:
- Gateway log streaming.
- System events with presence tracking.
- Agent session status overview.
- ACP compliance validation and IDE route integration tests.
- Deep scan and gateway token generation in doctor.
- Secrets plan apply and rollback.
- Dev profile isolation.
- Usage-based billing and team/workspace billing.
- Tenant-level skill pack and channel configuration.
- Mobile QR pairing polish, phone presence, and phone file access.
- Channel setup guides, migration guide, changelog generation, versioning policy, breaking change policy, Homebrew formula, npm publish and changelog automation.

Requirements:
- Add tests for each area you touch.
- Keep docs honest about what is complete versus partial.
- Make recovery, setup, and release flows reproducible.

Acceptance:
- The platform is operationally complete enough to ship, support, and document.
```

## 14. Category-forming moat work

```text
You are working in the Carina core codebase. Close the remaining category-forming gaps from CARINA_CATEGORY.md.

Scope:
- Make Carina the only credible option for the category it defines.
- Strengthen the moat with security, marketability, cross-agent learning, ecosystem, and proof.
- Build only what materially changes product capability.

Requirements:
- Expand cross-agent skill sharing.
- Build the Carina Hub marketplace into a real ecosystem.
- Build the third-party domain pack ecosystem.
- Build the enterprise offering and support model around the MIT kernel.
- Add a Built on Carina certification path.
- Keep all claims grounded in shipped capability and measurable outcomes.

Acceptance:
- Carina reads as a category, not a feature list.
- The product, ecosystem, and proof support the category claim.
```

## Checklist gaps still worth explicit follow-up

These are still partial or open in the merged capability inventory and should be queued as their own prompts if you want full closure:

- Reasoning effort detection
- Streaming compatibility matrix doc
- Channel setup docs
- Node WebSocket transport
- Unix socket approval daemon
- TaskFlow DSL
- Flow retry and resume
- Kanban worker integration
- Session lineage and scrolling
- Separate memory stores
- Workspace watcher
- Deep scan and gateway token generation
- Secrets plan apply and rollback
- Gateway log streaming
- System events with presence
- Agent session status overview
- ACP compliance validation
- IDE route integration tests
- Sandbox container integration with tool policy
- Automated attestation on critical events
- Role-based access control for tools
- Usage-based billing
- Team/workspace billing
- Tenant-level skill pack and channel configuration
- Phone control, presence, and file access
- Changelog generation
- Versioning policy
- Breaking change policy
- Homebrew formula
- npm publish and changelog automation
