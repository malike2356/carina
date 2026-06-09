# Phase 3.3; DevOps + GitHub + Software Development Skills

## Task
Port DevOps, GitHub, and software development skills. These cover Kanban orchestration, server troubleshooting, GitHub workflows, code review, TDD, debugging, and implementation planning.

## DevOps Skills

### kanban-orchestrator
Decomposition playbook for orchestrating complex work across multiple workers.
Rules: Break tasks into bite-sized units, avoid scope creep.

### kanban-worker
Worker pitfalls, examples, and edge cases for Kanban workers.
Rules: One task at a time, report status, handle failures.

### server-troubleshooting
Debug web server issues on VPS. Common scenarios: Cloudflare 520 errors, nginx config, PHP-FPM, MySQL connection.
Uses: SSH, nginx logs, PHP error logs, MySQL status.

### webhook-subscriptions
Webhook subscriptions for event-driven agent runs.
Uses: Webhook registration, signature verification, payload handling.

## GitHub Skills

### codebase-inspection
Inspect codebases with pygount: LOC, languages, ratios.
Uses: pygount CLI, code metrics.

### github-auth
GitHub auth setup: HTTPS tokens, SSH keys, gh CLI login.
Uses: gh CLI, SSH keygen.

### github-code-review
Review PRs: diffs, inline comments via gh or REST API.
Uses: gh pr diff, gh pr review, GitHub REST API.

### github-issues
Create, triage, label, assign GitHub issues via gh or REST API.
Uses: gh issue create/list/edit, GitHub REST API.

### github-pr-workflow
GitHub PR lifecycle: branch, commit, open, CI, merge.
Uses: git branching, gh pr create, CI status checks.

### github-repo-management
Clone/create/fork repos, manage remotes, releases.
Uses: git clone, gh repo create/fork, git remote.

## Software Development Skills

### debugging-hermes-tui-commands
Debug TUI slash commands: Python, gateway, Ink UI.
Uses: Python debugger, Gateway logs, Ink component inspection.

### node-inspect-debugger
Debug Node.js via --inspect + Chrome DevTools Protocol CLI.
Uses: node --inspect, Chrome DevTools, CDP commands.

### python-debugpy
Debug Python: pdb REPL + debugpy remote (DAP).
Uses: pdb, debugpy, VS Code DAP integration.

### plan
Plan mode: write markdown implementation plan to .hermes/plans/.
No execution; planning only.

### requesting-code-review
Pre-commit review: security scan, quality gates, auto-fix.
Uses: Static analysis, lint rules, security scanners.

### spike
Throwaway experiments to validate an idea before building.
Rules: Time-boxed, no production code, document findings.

### subagent-driven-development
Execute plans via delegate_task subagents with 2-stage review.
Rules: Spec review then quality review, never skip reviews.

### systematic-debugging
4-phase root cause debugging: understand before fixing.
Phases: Reproduce, isolate, fix, verify.

### test-driven-development
TDD: enforce RED-GREEN-REFACTOR, tests before code.
Rules: Write failing test -> minimal code -> pass -> refactor.

### writing-plans
Write implementation plans: bite-sized tasks, exact paths, code sketches.
Rules: Each task 2-5 minutes, includes file paths and test targets.

## Porting instructions
Each skill must include:
- Exact commands (not pseudocode)
- Error handling for common failures
- Dependencies list (tools that must be installed)
- Platform-specific notes (Linux vs macOS vs Windows)
- Verification steps
