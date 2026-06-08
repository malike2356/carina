# Phase 3.1 — Autonomous AI Agents Skills

## Task
Port the autonomous AI agent delegation skills. These enable Carina to delegate coding tasks to external AI coding agents (Claude Code, OpenAI Codex, OpenCode) and manage multi-agent workflows.

## Skills to port

### claude-code
Delegate coding tasks to Claude Code CLI. Use for features, PRs, bug fixes.
- Tool: claude-code (or terminal with PTY mode)
- Workflow: write spec -> delegate -> review output -> commit
- Handles: multi-file features, code generation, test writing

### codex
Delegate coding tasks to OpenAI Codex CLI.
- Same pattern as claude-code, different backend
- Use when Claude Code is unavailable or for comparison

### opencode
Delegate coding tasks to OpenCode CLI.
- Third delegation option
- Use for PR review, smaller focused tasks

### hermes-agent
Configure, extend, or contribute to Carina itself (meta-skill).
- Commands: carina config set, carina tools, carina setup
- Use when the user asks about configuring Carina's own settings

### kanban-codex-lane
Kanban worker that runs Codex CLI for specific lanes.
- Integration with project management workflows

### openclaw-integration
Share knowledge and communicate between Carina and OpenClaw agents.
- 5-minute knowledge sync
- Task handoff protocol

## Porting instructions

For each skill, create a SKILL.md file with:

```yaml
---
name: skill-name
description: One-line description
category: autonomous-ai-agents
---
```

Then:
1. Trigger conditions: When should Carina load this skill?
2. Steps: Numbered, with exact commands
3. Pitfalls: Common errors and how to avoid them
4. Verification: How to confirm the skill worked

Skills live in: skills/autonomous-ai-agents/

## Verification
Each skill must:
- Load correctly via skill_view or equivalent
- Execute its primary function without errors
- Handle edge cases (tool not installed, API error, timeout)
- Log to Scout audit trail where applicable
