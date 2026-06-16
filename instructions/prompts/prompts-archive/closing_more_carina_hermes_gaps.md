Based on the excerpt, the gaps where Herlox is still ahead are these:

  1. Tool count
  2. Skill maturity
  3. Skill count
  4. Session search
  5. Cron and chaining
  6. Background process management
  7. Kanban
  8. Webhooks
  9. TUI
  10. Profiles and isolation

  A few of those are not just "missing" features; they are maturity gaps. For example, skill maturity, session
  search polish, background process control, and profiles isolation are partly about quality and operational fit,
  not only code presence.

  Below are full prompts to close each gap.

  1. Tool Count

  Prompt:

  You are working in the Carina codebase. Close the tool-count gap versus the reference agent by inventorying
  every existing tool surface, then adding missing high-value agent tools until Carina has parity or a clear
  advantage in practical capability.

  Goals:
  - Enumerate all current tools across CLI, web, ops, MCP, Playwright, cron, channels, and subagent/delegate
  flows.
  - Compare them against the reference capability list from this task.
  - Add missing tools only where they provide real operator value, not filler.
  - Prefer reusable primitives over one-off commands.
  - Keep tool naming consistent with existing Carina conventions.

  Requirements:
  - Produce a tool inventory document with current count, category, and purpose.
  - Add tests for every new tool.
  - Ensure new tools are exposed through the right surfaces, with auth and audit behavior matching the surrounding
  system.
  - Update docs and any registry metadata needed for discovery.
  - Do not break current public APIs.

  Acceptance criteria:
  - Carina has a larger and more useful agent tool surface.
  - Tool inventory is complete and checked into the repo.
  - New tools are reachable from the relevant runtime entry points.
  - Tests pass.

  2. Skill Maturity

  Prompt:

  You are working in the Carina codebase. Turn the newly built learning-loop skill system into a mature,
  production-grade feature.

  Goals:
  - Review the current learning loop implementation end to end.
  - Identify failure modes in capture, correction, re-entry, persistence, and retrieval.
  - Harden the loop so it handles repeated corrections, partial context, and conflicting feedback.
  - Add observability so learning events can be audited and replayed.
  - Make the skill update loop safe to run repeatedly without drift or duplication.

  Requirements:
  - Add tests for first use, repeated correction, malformed input, and recovery from partial failure.
  - Ensure learning artifacts are versioned and traceable.
  - Ensure the loop can operate in local and hosted modes.
  - Keep internal research and planning notes private if they are not user-facing.
  - Update docs only where they are part of the product behavior.

  Acceptance criteria:
  - The learning loop is not just present; it is stable under repeated real use.
  - Corrections actually change future behavior in a measurable way.
  - Tests cover the full correction lifecycle.
  - No regressions in existing skill execution.

  3. Skill Count

  Prompt:

  You are working in the Carina codebase. Expand the curated skill library to close the skill-count gap while
  keeping quality higher than quantity.

  Goals:
  - Audit the current skill catalog by domain and use case.
  - Identify missing but high-value skills for daily operator use.
  - Add new skills only if they are genuinely useful, documented, and testable.
  - Avoid duplicating near-identical skills.

  Requirements:
  - Create a skill roadmap grouped by priority and user value.
  - Implement the top missing skills with clean manifests, prompts, and any needed resources.
  - Add install and discovery metadata where appropriate.
  - Ensure skills are visible in the right surfaces and hidden from places they should not appear.
  - Add tests or validation checks for skill registration and execution.

  Acceptance criteria:
  - Carina has broader skill coverage in the areas users actually need.
  - Skill definitions are discoverable, consistent, and maintainable.
  - Catalog size increases without lowering signal quality.

  4. Session Search

  Prompt:

  You are working in the Carina codebase. Upgrade session search from basic Postgres full-text search to a faster,
  more polished retrieval experience.

  Goals:
  - Review current session indexing, storage, and search code.
  - Improve relevance ranking, filtering, and result presentation.
  - Add support for fast prefix, fuzzy, and semantic-like retrieval where appropriate.
  - Make search usable across large histories without obvious latency spikes.

  Requirements:
  - Preserve existing search behavior where users depend on it.
  - Add a search API with clear ranking rules and stable pagination.
  - Add performance tests and relevance tests.
  - Add fallback behavior when indexes are stale or unavailable.
  - Ensure the feature works in the web UI and any CLI or admin surfaces that expose search.

  Acceptance criteria:
  - Search is faster and feels more responsive.
  - Relevant sessions surface first in common queries.
  - Large session histories remain usable.
  - Tests prove ranking and fallback behavior.

  5. Cron and Chaining

  Prompt:

  You are working in the Carina codebase. Expand the cron system from basic scheduled jobs into a full chaining
  workflow engine for agent tasks.

  Goals:
  - Review the current cron implementation and its job execution model.
  - Add support for chained steps, dependencies, retries, and multi-delivery outputs.
  - Support passing context from one scheduled action to the next.
  - Keep the interface simple enough for operators to use safely.

  Requirements:
  - Add declarative chaining syntax.
  - Add job state persistence and retry semantics.
  - Add tests for linear chains, branching failure, retries, and completion delivery.
  - Ensure chained jobs can hand off context without leaking unrelated state.
  - Document the workflow format and operator-facing commands.

  Acceptance criteria:
  - Cron can orchestrate multiple steps, not just isolated jobs.
  - Failures are visible and recoverable.
  - Chained outputs reach the right destination reliably.

  6. Background Process Management

  Prompt:

  You are working in the Carina codebase. Build a mature background process manager for long-running agent work.

  Goals:
  - Review existing PTY and process primitives.
  - Add structured process tracking, pattern watching, completion notifications, and cancellation.
  - Make process lifecycle visible to the user and to the admin surfaces.
  - Prevent orphaned or duplicated background jobs.

  Requirements:
  - Add a process registry with stable IDs.
  - Support watch rules for output patterns and exit conditions.
  - Support notify-on-complete and notify-on-failure behavior.
  - Add tests for long-running tasks, partial output, cancellation, and restart recovery.
  - Expose process state in the appropriate UI or API surfaces.

  Acceptance criteria:
  - Background jobs can be started, watched, stopped, and resumed with predictable behavior.
  - Operators can see what is running and why.
  - The system handles failure without losing track of the process.

  7. Kanban

  Prompt:

  You are working in the Carina codebase. Replace the basic kanban tool with a full board workflow for operator
  planning.

  Goals:
  - Review current kanban functionality and data model.
  - Add a board view with worker and orchestrator roles.
  - Support card lifecycle, assignment, status transitions, and notes.
  - Make the board useful for real multi-step agent work, not just display.

  Requirements:
  - Add persistent board state.
  - Add APIs for creating, updating, moving, and closing cards.
  - Add UI controls that are fast to use and clear at a glance.
  - Add tests for workflow transitions, permissions, and concurrency.
  - Make sure cards do not overlap or resize unpredictably in the UI.

  Acceptance criteria:
  - Kanban can drive actual work, not just track it.
  - Users can manage tasks from board to completion.
  - State remains consistent across reloads and sessions.

  8. Webhooks

  Prompt:

  You are working in the Carina codebase. Mature the webhook subsystem into a full subscribe, manage, and trigger
  experience.

  Goals:
  - Review current webhook support.
  - Add webhook subscription management, delivery retries, event filtering, and visibility.
  - Support safe triggering from both internal and external sources.
  - Make delivery status observable and debuggable.

  Requirements:
  - Add endpoints for subscribe, update, disable, retry, and inspect.
  - Add signing or verification where appropriate.
  - Add a delivery log and failure status.
  - Add tests for normal delivery, invalid signatures, retries, and disabled endpoints.
  - Keep webhook permissions aligned with existing auth patterns.

  Acceptance criteria:
  - Webhooks are reliable enough for operational use.
  - Operators can see what was sent and what failed.
  - Webhook management is safe and auditable.

  9. TUI

  Prompt:

  You are working in the Carina codebase. Build a terminal UI that makes the agent usable interactively without
  requiring the web app.

  Goals:
  - Create a full TUI for the most important operator flows.
  - Include session browsing, task status, process control, and quick command entry.
  - Make it keyboard efficient and responsive.

  Requirements:
  - Reuse existing data and commands instead of inventing duplicate logic.
  - Add panes or views for sessions, jobs, tools, and logs.
  - Make the UI resilient to narrow terminals.
  - Add tests for command handling and view rendering where practical.
  - Keep the TUI optional and non-invasive to existing CLI behavior.

  Acceptance criteria:
  - Users can operate the agent from terminal alone.
  - The TUI supports the main workflows without feeling bolted on.
  - Layout remains stable and readable.

  10. Profiles and Isolation

  Prompt:

  You are working in the Carina codebase. Strengthen profile isolation so each instance behaves like a truly
  separate environment.

  Goals:
  - Audit how profiles, workspaces, skills, plugins, cron, memory, and credentials are scoped.
  - Tighten boundaries so one profile cannot leak state into another.
  - Make switching profiles predictable and reversible.

  Requirements:
  - Separate config, data, resources, credentials, and runtime metadata by profile.
  - Ensure profile-bound commands resolve the correct environment every time.
  - Add tests for switching, isolation, and cross-profile contamination.
  - Surface profile scope clearly in the UI and CLI.
  - Preserve compatibility with existing workspace behavior where possible.

  Acceptance criteria:
  - Profiles behave like isolated instances, not loose folders.
  - Cross-profile bleed is prevented.
  - Operators can verify which profile is active at any time.

  If you want this turned into a tighter execution plan, the right next step is to rank these by impact. My order
  would be: skill maturity, profiles isolation, cron and chaining, background processes, session search, kanban,
  webhooks, TUI, then raw tool and skill count.

