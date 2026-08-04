import type { PackSkillInput } from '../property-uk/skills.js';

export const coreEngineeringSkills: PackSkillInput[] = [
  {
    name: 'delegate-coding-task',
    description: 'Delegate substantial coding work to an isolated subagent',
    trigger: ['implement this', 'write the code', 'build this feature', 'refactor this module'],
    steps: `1. Write a self-contained spec: goal, file paths, constraints, expected output.
2. Use delegate-task with toolsets: ["terminal", "file"] and the project workdir.
3. Subagent runs in isolation; you receive only its final summary.
4. Verify critical outputs (file paths, test results) before reporting done.
5. For trivial one-liner edits, use file-write directly instead.`,
    toolsUsed: ['delegate-task'],
  },
  {
    name: 'claude-code-cli',
    description: 'Run coding tasks via Claude Code CLI when installed',
    trigger: ['claude code', 'cursor cli'],
    steps: `1. Check if claude CLI is installed: shell-exec "which claude".
2. Delegate via delegate-task with a clear spec, or run via shell-exec if simple.
3. Review output before treating as complete.`,
    toolsUsed: ['shell-exec', 'delegate-task'],
  },
  {
    name: 'codex-cli',
    description: 'Run coding tasks via Codex CLI when installed',
    trigger: ['codex', 'openai codex', 'codex cli'],
    steps: `1. Check if codex CLI is installed: shell-exec "which codex".
2. Delegate substantial work via delegate-task; simple commands via shell-exec.
3. Review results before completion.`,
    toolsUsed: ['shell-exec', 'delegate-task'],
  },
  {
    name: 'opencode-review',
    description: 'PR review and focused changes via OpenCode CLI',
    trigger: ['opencode', 'pr review', 'review this diff', 'code review'],
    steps: `1. Check if opencode CLI is installed: shell-exec "which opencode".
2. Delegate review via delegate-task with toolsets: ["terminal", "file"].
3. Summarise actionable findings from the subagent summary.`,
    toolsUsed: ['shell-exec', 'delegate-task'],
  },
  {
    name: 'parallel-research',
    description: 'Run independent research tasks in parallel via delegate-task batch mode',
    trigger: ['research both', 'compare these', 'in parallel', 'simultaneously'],
    steps: `1. Split into independent sub-goals with no shared dependencies.
2. Use delegate-task batch mode with up to 3 tasks per call.
3. Synthesise subagent summaries into one coherent answer.`,
    toolsUsed: ['delegate-task', 'web-search'],
  },
  {
    name: 'github-auth',
    description: 'Verify and configure GitHub CLI authentication',
    trigger: ['gh auth', 'github login', 'github authentication'],
    steps: `1. Run shell-exec "gh auth status".
2. If not authenticated, guide user through "gh auth login".
3. Confirm SSH or HTTPS token is working before PR/issue operations.`,
    toolsUsed: ['shell-exec'],
  },
  {
    name: 'github-pr-workflow',
    description: 'Branch, commit, PR create, CI check, merge workflow',
    trigger: ['pull request', 'create pr', 'gh pr', 'merge pr'],
    steps: `1. Confirm gh auth status succeeds.
2. git checkout -b feature/name
3. Commit changes with clear message.
4. gh pr create --title "..." --body "..."
5. gh pr checks; merge when green.`,
    toolsUsed: ['shell-exec'],
  },
  {
    name: 'github-code-review',
    description: 'Review PRs with gh pr diff and review commands',
    trigger: ['review pr', 'pr diff', 'code review github'],
    steps: `1. gh pr diff <number> for full diff.
2. gh pr review --comment for feedback.
3. Summarise findings: bugs, style, security, tests.`,
    toolsUsed: ['shell-exec'],
  },
  {
    name: 'github-issues',
    description: 'Create, list, and triage GitHub issues',
    trigger: ['github issue', 'create issue', 'triage issues'],
    steps: `1. gh issue create --title --body for new issues.
2. gh issue list --label for filtered views.
3. Add labels and assignees as needed.`,
    toolsUsed: ['shell-exec'],
  },
  {
    name: 'systematic-debugging',
    description: 'Four-phase debugging: reproduce, isolate, fix, verify',
    trigger: ['debug', 'bug', 'not working', 'error trace', 'fix this issue'],
    steps: `1. Reproduce: get exact steps and error message.
2. Isolate: narrow to smallest failing unit.
3. Fix: apply minimal change.
4. Verify: run tests and confirm regression-free.`,
    toolsUsed: ['shell-exec', 'file-read'],
  },
  {
    name: 'test-driven-development',
    description: 'RED-GREEN-REFACTOR test-first development',
    trigger: ['tdd', 'test first', 'write tests', 'red green refactor'],
    steps: `1. Write a failing test for the desired behaviour.
2. Write minimal code to pass (GREEN).
3. Refactor without changing behaviour.
4. Never write production code without a failing test first.`,
    toolsUsed: ['shell-exec', 'file-write'],
  },
  {
    name: 'browser-research',
    description: 'Research web pages using browser automation',
    trigger: ['browse', 'website', 'web page', 'fill form', 'scrape page'],
    steps: `1. browser-navigate to target URL.
2. browser-snapshot for interactive refs.
3. browser-click/type/press as needed.
4. Prefer http-request for plain-text APIs.`,
    toolsUsed: ['browser-navigate', 'browser-snapshot', 'browser-click'],
  },
  {
    name: 'scheduled-automation',
    description: 'Set up recurring tasks with cronjob',
    trigger: ['schedule', 'cron', 'recurring', 'automate daily'],
    steps: `1. Clarify schedule format.
2. cronjob create with self-contained prompt.
3. Set deliver channel; confirm with cronjob list.`,
    toolsUsed: ['cronjob'],
  },
  {
    name: 'session-recall',
    description: 'Search past conversations and save durable facts',
    trigger: ['remember when', 'previous session', 'what did we discuss'],
    steps: `1. session-search with relevant query.
2. Review snippets and scroll if needed.
3. memory tool to save durable facts.`,
    toolsUsed: ['session-search', 'memory'],
  },
  {
    name: 'codebase-inspection',
    description: 'Analyse codebase size, languages, and structure',
    trigger: ['codebase stats', 'lines of code', 'project structure', 'loc count'],
    steps: `1. Probe for pygount via shell-exec "which pygount".
2. If present, run for LOC and language breakdown.
3. Fallback: find + wc for file counts by extension.`,
    toolsUsed: ['shell-exec', 'file-read'],
  },
  {
    name: 'writing-plans',
    description: 'Break tasks into bite-sized implementation steps',
    trigger: ['write a plan', 'implementation plan', 'step by step plan'],
    steps: `1. Decompose into 2-5 minute tasks.
2. Name exact file paths for each step.
3. Include code sketches where helpful.
4. Order by dependency.`,
    toolsUsed: [],
  },
  {
    name: 'requesting-code-review',
    description: 'Pre-commit quality checklist before review',
    trigger: ['ready for review', 'pre-commit check', 'quality gate'],
    steps: `1. Run pnpm test and pnpm build.
2. Check for secrets, debug logs, TODOs.
3. Verify types and lint pass.
4. Summarise changes for reviewer.`,
    toolsUsed: ['shell-exec'],
  },
  {
    name: 'carina-cli-help',
    description: 'Help users configure and operate Carina CLI',
    trigger: ['carina config', 'carina setup', 'install pack', 'carina help'],
    steps: `1. Point to: carina setup, ACTIVE_SKILL_PACKS env, CARINA_RESOURCES_DIR.
2. User skills go in $CARINA_RESOURCES_DIR/skills/*.json.
3. Knowledge docs go in $CARINA_RESOURCES_DIR/knowledge/.
4. List available packs with carina packs list.`,
    toolsUsed: ['shell-exec', 'file-read'],
  },
];
