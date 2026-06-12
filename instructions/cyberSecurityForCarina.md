 I reviewed the audit. The real Scout-relevant work is narrower than the full checklist.

  Do these in Scout:

  - threat model table and mitigation matrix
  - session lineage / provenance for incidents
  - replay-safe webhook / TaskFlow behavior
  - provider capability provenance and reasoning-effort labels
  - operator-facing observability for incidents and logs

  Do not push these into Scout:

  - credentials profiles UI
  - migration guide
  - changelog/Homebrew/release tooling
  - YAML DSL for TaskFlows
  - node WebSocket transport
  - Unix socket approval daemon

  Those belong in Core, docs, or release tooling.

  ## Threat model table

  Use this as the working table for Carina + Scout:

   Attack                               Surface                                           Impact                                 Current mitigation                     Gap to close
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Prompt injection                     chat, web, email, docs, tool output               tool misuse, bad actions, data leak    Scout prompt guard, tool policy        lineage/provenance in incidents
  ───────────────────────────────────  ────────────────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────
   Tool abuse / SSRF                    HTTP, shell, code, file tools                     internal access, exfiltration          egress filter, tool policy             better per-session traceability
  ───────────────────────────────────  ────────────────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────
   Tenant breakout / BOLA               hosted APIs, billing, memory, Scout dashboards    cross-tenant data access               tenant auth/isolation                  incident/session lineage
  ───────────────────────────────────  ────────────────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────
   Memory poisoning                     memory ingest, skill write, session cache         future bad decisions                   memory controls, opt-in skill write    provenance on stored context
  ───────────────────────────────────  ────────────────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────
   Webhook replay / flow duplication    TaskFlows, webhooks                               duplicate actions, double sends        webhook dispatcher                     idempotency + retry audit
  ───────────────────────────────────  ────────────────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────
   Plugin / supply-chain abuse          extensions, provider plugins                      malicious tool or prompt behavior      validation/gates                       explicit provenance and load policy
  ───────────────────────────────────  ────────────────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────
   Cost/DoS abuse                       provider routing, chat loops                      API burn, outage                       rate limits, cost tracker              route-level provenance and limits
  ───────────────────────────────────  ────────────────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────  ─────────────────────────────────────
   Observability gaps                   logs, dashboard, events                           slower incident response               Scout dashboard                        better lineage and replay context

  ## Prompt 1: Threat model and mitigation matrix for Scout

  In the Scout codebase, add a first-class threat model and mitigation matrix for Carina and connected agents.

  Goal:
  - Create a canonical security reference that maps attacks to surfaces, mitigations, and residual gaps.
  - Keep it honest and compact.
  - Use existing Scout terminology and code paths only.
  - Do not add any runtime latency to the agent loop.

  What to build:
  1. Create a threat model doc or page.
  - Add a page such as `docs/security/threat-model.md` or the equivalent Scout docs page.
  - Include a table with:
    - attack
    - affected surface
    - impact
    - current mitigation
    - remaining gap
    - owner / next action
  - Cover the major agent risks:
    - prompt injection
    - tool abuse / SSRF
    - tenant breakout / BOLA
    - memory poisoning
    - webhook replay / duplicate task execution
    - plugin / extension supply-chain abuse
    - cost / DoS abuse
    - observability gaps

  2. Hook it into the docs and dashboard.
  - Link the threat model from the main Scout docs index.
  - Add a short pointer from the public trust or dashboard help surface if that fits the current UI.
  - Keep the wording at the outcome level, not the implementation level.

  3. Keep sensitive implementation details out of the public copy.
  - Do not enumerate exact internal guard names or layer counts in the public page.
  - Describe outcomes and operator actions, not the full pipeline.

  4. Add tests.
  - Verify the doc/page renders.
  - Verify links from the docs index or dashboard help are present.
  - If the page is generated from code, add a snapshot or content test.

  Files to inspect first:
  - `console.labyrinthscout.com/docs/*`
  - `console.labyrinthscout.com/public/dashboard.html`
  - `console.labyrinthscout.com/public/dashboard/js/*`
  - `console.labyrinthscout.com/src/security/*`
  - `console.labyrinthscout.com/src/api/*`

  Acceptance criteria:
  - Scout has one canonical threat model reference.
  - The table is readable by operators.
  - Sensitive internals are not leaked.
  - Tests pass.

  ## Prompt 2: Session lineage and incident provenance

  In the Scout and Carina telemetry path, add session lineage and incident provenance so security events can be reconstructed cleanly.

  Goal:
  - Track parent/child session relationships.
  - Make incident investigations easier.
  - Preserve normal runtime speed.
  - Do not add any extra model calls.

  What to build:
  1. Add lineage fields.
  - Add `parent_session_id` and/or `root_session_id` to the session model where it makes sense.
  - Propagate lineage into security events, task runs, and relevant dashboard payloads.
  - Keep the schema backward-compatible.

  2. Surface lineage in incident views.
  - Show the originating session/thread for a security event.
  - Show whether an incident is a continuation, retry, or new branch.
  - Make it easy to navigate from an event to related events.

  3. Use lineage for replay-resistant operations.
  - When a webhook or TaskFlow is retried, preserve attempt lineage.
  - Record the original trigger and any follow-up execution path.

  4. Add tests.
  - lineage creation
  - lineage propagation through events
  - dashboard rendering
  - replay/attempt traceability

  Files to inspect first:
  - `console.labyrinthscout.com/src/api/*`
  - `console.labyrinthscout.com/src/security/*`
  - `console.labyrinthscout.com/src/lib/*`
  - `core.carinaai.uk/src/memory/*`
  - `core.carinaai.uk/src/gateway/*`
  - `core.carinaai.uk/src/telemetry/*`

  Acceptance criteria:
  - Every important security event can be traced back to a parent session.
  - The lineage is visible in operator surfaces.
  - Existing workflows keep working.
  - Tests pass.

  ## Prompt 3: Replay safety and provider provenance

  In Scout and Carina, harden webhook / TaskFlow replay behavior and provider provenance so operators can trust what ran and why.

  Goal:
  - Prevent duplicate or ambiguous TaskFlow execution.
  - Make provider selection and routing provenance visible.
  - Keep this as metadata and control-plane logic, not a runtime slowdown.

  What to build:
  1. TaskFlow replay safety.
  - Add idempotency keys where they are missing.
  - Track retry count and max retries on TaskFlow steps.
  - Ensure webhook-triggered flows cannot silently double-execute.
  - Preserve a clear attempt history for failed and retried runs.

  2. Provider provenance.
  - Add/extend provider metadata for:
    - configured state
    - transport type
    - streaming capability
    - reasoning-effort / extended-thinking support where applicable
  - Add a provider compatibility matrix generated from the catalog.
  - Expose that matrix in CLI/docs so operators know what is actually supported.

  3. Routing honesty.
  - When a provider is experimental, local, or alias-based, label it honestly.
  - Keep “configured” distinct from “supported” and “live.”
  - Do not claim routing support that the backend cannot actually use.

  4. Add tests.
  - idempotency / retry behavior
  - max retry enforcement
  - provider metadata generation
  - capability matrix generation
  - honest unavailable/partial status

  Files to inspect first:
  - `core.carinaai.uk/src/ops/taskflows/*`
  - `core.carinaai.uk/src/brain/provider-registry.ts`
  - `core.carinaai.uk/src/brain/provider-catalog.ts`
  - `core.carinaai.uk/src/brain/provider-capabilities.ts`
  - `core.carinaai.uk/src/cli/commands/providers-cli.ts`
  - `core.carinaai.uk/docs/capabilities.md`
  - `console.labyrinthscout.com/src/api/*`

  Acceptance criteria:
  - Replayed flows are traceable and do not silently double-run.
  - Provider routing is described honestly.
  - Operators can see capability differences.
  - Tests pass.

  ## Prompt 4: Operations visibility for security response

  In Scout, improve the operator visibility needed to respond to security events quickly.

  Goal:
  - Make incident investigations faster.
  - Keep the UI focused on action and traceability.
  - Do not expose internal implementation details that are not needed for response.

  What to build:
  1. Incident views.
  - Show session lineage, event source, retry history, and related events.
  - Make it easy to jump from a risk event to the underlying session.

  2. Operator actions.
  - Keep response actions visible and minimal.
  - Make the available actions obvious without publishing the full security stack.

  3. Public/privileged split.
  - Keep public trust views high-level.
  - Keep detailed incident controls in the operator console only.

  4. Tests.
  - incident rendering
  - lineage links
  - operator action visibility
  - public/private separation

  Files to inspect first:
  - `console.labyrinthscout.com/public/dashboard.html`
  - `console.labyrinthscout.com/public/dashboard/js/*`
  - `console.labyrinthscout.com/src/api/*`
  - `console.labyrinthscout.com/src/security/*`

  Acceptance criteria:
  - Operators can investigate incidents faster.
  - Public pages stay high-level.
  - Sensitive internals are not leaked.
  - Tests pass.

  ## What I would do first

  1. Prompt 1, because it gives you the canonical security model without leaking internals.
  2. Prompt 2, because lineage is the biggest practical improvement for real investigations.
  3. Prompt 3, because replay safety and provider provenance reduce bad behavior and ambiguity.
  4. Prompt 4 only if you want the operator console tightened further.

  If you want, I can turn the same audit into a core-only prompt set for the non-Scout items next.

 

