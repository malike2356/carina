Use this prompt in Claude or Cursor:

  In the carina codebase, close the remaining OpenClaw feature gap as far as the existing architecture allows, without
  slowing normal runtime or duplicating systems that already exist under different names.

  Important constraints:
  - Preserve Carina’s current chat speed.
  - Do not add extra model calls or network round trips to the normal agent loop.
  - If a feature already exists under another name, extend it instead of creating a duplicate.
  - Keep new capabilities opt-in, operator-driven, and test-covered.
  - Do not break current Carina, Scout, billing, or hosted workflows.
  - Where a feature is fundamentally platform-specific or not safe to ship in core, implement the closest safe
  equivalent and label it honestly.

  First task:
  1. Audit the repo and produce a gap map for the items below.
  - Mark each item as:
    - already exists
    - partial / needs extension
    - missing
    - not appropriate for this product
  - For items that already exist, find the current implementation and extend it rather than rebuilding from scratch.
  - For missing items, implement the smallest clean version that fits Carina’s architecture.

  Then implement the missing and partial items in priority order.

  Priority 1: Provider breadth and copilot mode
  - Expand the provider system so Carina can route across a wide catalog of providers and local engines.
  - Add a Free Copilot preset that prefers genuinely free/local configured providers first.
  - Add support for OpenRouter, Bedrock-style endpoints, OpenAI-compatible custom endpoints, Ollama, LM Studio, vLLM,
  DeepSeek, Groq, Gemini, Anthropic, OpenAI, Hugging Face, xAI, Qwen, Mistral/Moonshot-style routes where the codebase
  can support them cleanly.
  - Keep provider capability metadata data-driven.
  - Add provider discovery, health checks, and deterministic fallback.
  - Expose the provider catalog in CLI/TUI/admin surfaces.
  - Do not slow the live turn path.

  Priority 2: Plugin/extensibility system
  - Add an installable plugin/bundle mechanism so Carina can extend like OpenClaw without hardcoding every tool.
  - Support plugin metadata, install/enable/disable/remove, versioning, and compatibility checks.
  - Allow plugins to contribute:
    - tools
    - skills
    - prompt fragments
    - integrations
    - optional ACP/MCP exports
  - Add a safe operator workflow for installing and validating plugins before enablement.
  - Add an offline evaluation gate before plugin activation.
  - Reuse the existing skills/packs/curator systems if possible.

  Priority 3: Messaging and channel breadth
  - Extend or formalize support for the missing channel bridges:
    - Signal
    - iMessage / BlueBubbles
    - Matrix
    - Mattermost
    - IRC
    - WhatsApp bridge behavior if already present but disabled
  - Add honest capability reporting:
    - configured
    - partially configured
    - disabled
    - unsupported
  - Add channel directory lookup, DM allowlisting, peer/group scoping, and thread ownership protections where they fit
  the existing chat architecture.
  - Keep channel connectors isolated from the core agent loop.

  Priority 4: Node host / remote agent mode
  - Add a headless node host daemon mode that can run on remote machines and connect back to the gateway.
  - Support service lifecycle commands:
    - install
    - start
    - stop
    - restart
    - status
    - uninstall
  - Add secure device pairing:
    - token-based pairing
    - approve/reject/revoke/rotate
    - QR code pairing for mobile/device onboarding
  - Add file transfer between gateway and paired nodes with size handling and clear limits.
  - Keep node-host communication explicit and authenticated.

  Priority 5: Sandboxing and command approval
  - Add a sandbox subsystem that can run agent sessions in isolated environments.
  - Support at least one container-based sandbox backend first.
  - Add an approval daemon or policy layer for dangerous commands:
    - allow
    - block
    - approve with expiry
    - per-agent policy
  - Add a mirrored local workspace / open-shell style backend if feasible in the current architecture.
  - Keep approvals auditable and per-profile/per-agent where appropriate.

  Priority 6: System operations
  - Add or harden operator tools for:
    - backup create / verify / restore
    - doctor health checks with auto-repair
    - secrets inspection and precedence checks
    - system event queue / presence tracking
    - security audit of local config
    - DNS/service discovery helpers if the repo already has the plumbing
  - Make backup archives include a manifest and integrity verification.
  - Make doctor output structured and actionable.
  - Keep these tools operator-only.

  Priority 7: Migration and interop
  - Add migration tools for importing from Hermes and Claude where possible:
    - config
    - memory
    - skills
    - credentials
    - instructions
  - Add export/import paths that preserve current Carina semantics.
  - If a migration source is only partially compatible, label the import as partial and report exactly what was
  migrated.

  Priority 8: Debug proxy and traffic inspection
  - Add a provider debug proxy that can capture and inspect model traffic for supported providers.
  - Expose:
    - which providers are proxied
    - which are not
    - request/response payload inspection by ID
    - purge captured data
  - Keep the proxy opt-in and operator-only.
  - Do not route normal chat through the proxy unless explicitly enabled.

  Priority 9: ACP bridge
  - Add an ACP bridge if it fits the architecture cleanly.
  - Support:
    - interactive client mode
    - session key / label management
    - provenance modes
    - password file support
  - If ACP overlaps with MCP or another protocol layer, reuse the existing transport and keep the implementation
  unified.

  Priority 10: TaskFlows and background tasks
  - Add durable automation workflows with a registry.
  - Support chaining webhooks, cron, and agent actions.
  - Add background task inspection:
    - queued
    - running
    - succeeded
    - failed
    - timed out
    - cancelled
    - lost
  - Add a separate session delivery queue if the codebase already models outbound delivery distinctly.
  - Make cron durable and inspectable.

  Priority 11: Skill workshop and memory/wiki tooling
  - Add a workflow capture / skill workshop feature so repeatable workflows can be turned into skills for review.
  - Add persistent wiki-style knowledge capture if the existing memory architecture can support it.
  - Keep any auto-write or auto-promotion logic offline or opt-in.
  - Do not let this add latency to ordinary chats.

  Priority 12: Model discovery, status, logs, help, and lifecycle commands
  - Add or harden CLI commands for:
    - provider/model discovery
    - logs tailing
    - health inspection
    - approvals management
    - capability inference
    - status overview
    - session listing
    - reset
    - onboard wizard
    - uninstall
    - shell completion
    - update checking
  - If these commands already exist partially, tighten them and make the output consistent.

  Priority 13: Profiles and multi-identity workflows
  - Make named profiles fully usable for multiple parallel identities.
  - Support dev/profile isolation and container mode if the repo already has the scaffolding.
  - Ensure state isolation across:
    - config
    - memory
    - providers
    - credentials
    - checkpoints
    - sessions
  - Add clear status and switching UI/CLI support.

  Priority 14: Apple/macOS ecosystem integrations
  - Add or formalize integrations that are already in the repo’s ecosystem where possible:
    - 1Password CLI
    - Apple Notes
    - Apple Reminders
    - Bear Notes
    - BlueBubbles / iMessage
    - Eight Sleep control
    - RTSP/ONVIF camera capture
  - Keep these as optional integrations, not hard dependencies.

  Implementation rules:
  - Build each feature only if the repo already has a sensible place for it.
  - Prefer small additive modules over a broad refactor.
  - If a feature overlaps with Scout security, keep Scout as the policy/control plane and Carina as the runtime.
  - Use existing auth, audit, profile, memory, and tool registry patterns.
  - Do not add new latency to the main chat path.
  - Everything new must be gated, auditable, and test-covered.

  Files and areas to inspect first:
  - `src/brain/llm.ts`
  - `src/providers/*`
  - `src/mcp/*`
  - `src/tools/*`
  - `src/cli/commands/*`
  - `src/tui/*`
  - `src/profiles/*`
  - `src/skills/*`
  - `src/memory/*`
  - `src/infrastructure/*`
  - `src/ops/*`
  - `src/integration/*`
  - `docs/*`
  - any existing plugin, sandbox, backup, or migration code

  Tests to add or update:
  - provider discovery and fallback
  - plugin install/enable/disable lifecycle
  - sandbox and approval policy
  - node host pairing and file transfer
  - backup/restore integrity
  - migration imports
  - ACP bridge transport
  - TaskFlows and background task inspection
  - profile isolation
  - no runtime slowdown in ordinary chat turns

  Acceptance criteria:
  - Carina covers the OpenClaw-style features that fit its architecture.
  - Existing systems are extended rather than duplicated.
  - All new capabilities are opt-in, operator-safe, and documented.
  - Normal chat remains fast.
  - Tests pass.
  - Any feature not implemented is explicitly marked with a reason.

  Best way to do this in practice:

  - start with the provider catalog and plugin/extensibility layer
  - then node host / sandbox / approvals
  - then migration and ops tooling
  - leave macOS-only integrations for last unless they already have code paths in the repo

  If you want, I can turn this into a phased version with one prompt per implementation sprint so Cursor does not try
  to swallow the whole list in one pass.

