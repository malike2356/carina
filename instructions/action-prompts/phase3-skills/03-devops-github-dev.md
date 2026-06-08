# Action: DevOps + GitHub + Software Engineering Skills (Reinterpreted as Skill Data, Standalone Carina)

## Goal
Port the genuinely high-value subset of this spec's 26 skills as Carina `Skill` data entries: GitHub workflow skills (using the `gh` CLI via `shell-exec`), debugging methodology skills (pure prose/process, no new tools), and planning/TDD skills (pure prose/process). Skip the skills that assume tooling specific to the other product's runtime (Hermes TUI, Ink components, Kanban boards) that has no Carina equivalent.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **Of the 26 skills in this spec, this is the highest-value file in the whole phase-3 batch** - unlike the creative/gaming/MLOps lists, GitHub workflows, debugging discipline, and planning methodology are exactly what a coding-capable AI agent needs, and they require zero new infrastructure: they're either thin wrappers around the `gh` CLI (already a `shell-exec` use case) or pure process/methodology skills (just well-written prose in `Skill.steps`).
- **Three skills don't translate and should be dropped, with the reason documented**:
  - `kanban-orchestrator`/`kanban-worker` - assume a Kanban board integration that doesn't exist for Carina (no `linear`/`trello`/board API is wired up; if the user wants this, it's a new integration project, not a skill-porting exercise)
  - `debugging-hermes-tui-commands` - literally describes debugging the OTHER product's TUI ("Python, gateway, Ink UI" - Carina is not a TUI and has no Ink components)
- `webhook-subscriptions` is borderline: Carina already HAS webhook handling (`src/api/email-webhook.ts`, verified for signature-verification gaps in `01-email-pipeline.md`). Rather than porting a generic "webhook subscriptions" skill, consider whether the agent needs to *understand* Carina's own webhook architecture (a skill teaching it to extend/debug `email-webhook.ts`-style handlers) - that's a more useful, more specific skill than a generic one.
- Read `src/skills/packs/property-uk/skills.ts` fully for the `Skill`/`PackSkillInput` data shape and prose-style conventions before writing anything.
- Conventions: skill `steps` are prose instructions for an LLM to follow, not executable scripts - write them the way `brr-analysis`'s numbered steps read (concrete, sequenced, with concrete thresholds/commands named inline).

## Files to create
- `src/skills/packs/core-engineering/skills.ts` - **if `01-autonomous-ai-agents.md` already created this pack, EXTEND that file rather than creating a second `core-engineering` pack** (check first - two packs with the same name, or two files claiming the same pack, is exactly the kind of fork this whole batch of prompts is trying to avoid)
- `src/skills/packs/core-engineering/pack.json` (update `skillCount` if extending)

## Step-by-step

1. Check whether `01-autonomous-ai-agents.md` has already produced `src/skills/packs/core-engineering/skills.ts`. If so, append to its `PackSkillInput[]` array and bump `pack.json`'s `skillCount` - do not create a competing file or pack.

2. **Port the GitHub skills as `gh`-CLI-driven entries** (5 skills, each `toolsUsed: ['shell-exec']`, each steps-prose explicitly checking for `gh auth status` before attempting operations that need it):
   - `github-auth`: steps for verifying `gh` is installed and authenticated, walking the user through `gh auth login` if not, and the SSH-key alternative
   - `github-pr-workflow`: branch -> commit -> `gh pr create` -> check CI status (`gh pr checks`) -> merge, with the spec's exact command sequence written into the steps prose (the spec explicitly asks for "exact commands, not pseudocode" - honour that: `git checkout -b feature/x`, `gh pr create --title ... --body ...`, `gh pr checks`, etc.)
   - `github-code-review`: `gh pr diff`, `gh pr review --comment/--approve/--request-changes`, when to use the REST API instead (large diffs, programmatic comment placement)
   - `github-issues`: `gh issue create/list/edit/close`, labelling and triage conventions
   - `github-repo-management`: `gh repo clone/create/fork`, `git remote` management, `gh release create`
   
   For each, the steps prose must tell the agent to confirm `gh auth status` succeeds before attempting authenticated operations, and what to tell the user if it doesn't (mirror the "check first, degrade gracefully" pattern from `01-autonomous-ai-agents.md`'s CLI-presence checks).

3. **Port `codebase-inspection`** as a `shell-exec`-driven entry: probe for `pygount` (`which pygount`), run it for LOC/language-ratio reports, fall back to a simpler `find | wc -l` + extension-counting approach if it's not installed (do not make the skill useless on a host without `pygount`).

4. **Port the pure-methodology skills as prose-only entries** (no `shell-exec`, `toolsUsed: []` or minimal) - these are the highest-value, lowest-risk ports because they're just well-written thinking processes:
   - `systematic-debugging` (4-phase: reproduce, isolate, fix, verify - write each phase's concrete substeps)
   - `test-driven-development` (RED-GREEN-REFACTOR cycle, with the discipline rule "never write production code without a failing test first" stated as an instruction the agent should hold itself to)
   - `writing-plans` (bite-sized 2-5-minute tasks, exact file paths, code sketches - this is *exactly* the format these action prompts themselves follow; consider noting that in the skill's description as a concrete worked example the agent can study)
   - `requesting-code-review` (pre-commit checklist: security scan, lint, what "quality gates" concretely means for a TypeScript/Node project - reference `pnpm test`/`pnpm build`/whatever lint command this repo uses)
   - `spike` (time-boxed throwaway experiments, explicit "do not let this become production code" discipline)
   - `subagent-driven-development` - **this one needs `06-delegate-task.md` to exist first**: it describes "execute plans via delegate_task subagents with 2-stage review," which only makes sense once `delegate-task` is a real, callable tool. Write the skill, but note the dependency explicitly so it isn't activated/discoverable before its prerequisite tool exists (check how the skill-loading system handles "skill references a tool that isn't registered" - if there's no graceful handling, that's worth flagging as a small gap).

5. **Reframe `server-troubleshooting`** for Carina's actual operating context - the spec describes "debug web server issues on VPS... Cloudflare 520, nginx, PHP-FPM, MySQL." Carina's own production stack is different (`docker-compose.prod.yml`, nginx + the Carina Node process + Postgres + Redis - no PHP-FPM, no MySQL). Either (a) write a Carina-stack-appropriate version (nginx + Node process health, Postgres connection issues, Redis connectivity, Docker container status), which is genuinely useful for someone running self-hosted Carina, or (b) keep it general enough to apply to "any nginx-fronted web service" without the PHP/MySQL specifics that won't apply to Carina's own deployments. Prefer (a) - a skill an operator can actually use on the system they're running is more valuable than a generic one.

6. **Decide on `node-inspect-debugger`/`python-debugpy`**: these are genuinely useful for a coding-capable agent working on Node/Python projects (which describes Carina's own codebase and likely many user projects). Port both as prose-driven `shell-exec` skills (`node --inspect`, `pdb`/`debugpy` invocation patterns) - they need no new infrastructure.

7. Write `pack.json` (or update it) with the final, accurate `skillCount`, and document the three dropped skills (`kanban-orchestrator`, `kanban-worker`, `debugging-hermes-tui-commands`) plus the `webhook-subscriptions` reframing decision in your completion summary.

## Expected behavior
- A user asking "open a PR for this branch" gets an agent that checks `gh auth status`, runs the right command sequence, and reports back the PR URL.
- A user debugging a production issue gets an agent that follows a disciplined reproduce-isolate-fix-verify process rather than guessing.
- A user asking for an implementation plan gets one in the bite-sized, file-path-and-test-target format `writing-plans` describes (which, not coincidentally, is the same format this whole batch of action prompts uses).

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/skills/
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "Open a PR for the current branch with a summary of the email-pipeline fixes"
# Confirm the agent checks gh auth, runs the correct gh commands, and reports the result
```

## Dependencies
- `gh` CLI on the host for the GitHub-workflow skills (probe-and-guide-setup, never assume present)
- `06-delegate-task.md` for `subagent-driven-development` to be meaningfully usable
- `01-autonomous-ai-agents.md`'s `core-engineering` pack, if it exists, to extend rather than fork
