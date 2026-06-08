# AGENTS.md — Carina Build Workspace

## Who you are

You are Claude and Cursor building Carina together. Treat this workspace as the single source of truth for the build.

## Rules

1. Read ROADMAP.md before starting any work. Know which phase you are in.
2. Read TARGET.md once. Internalize what we are building toward.
3. Read WORKFLOW.md before you start your first session. Know your role.
4. Do not skip phases. Do not build Phase 3 features during Phase 2.
5. Every file you create must have `declare(strict_types=1)` if PHP. Must be syntactically valid.
6. Every feature must be testable before it is considered "done."
7. When blocked, document the blocker in the phase file. Do not guess. Do not fake it.
8. Cursor codes. Claude reviews. Hermes deploys. Do not cross roles unless explicitly needed.

## How to use this workspace

- ROADMAP.md is the authority on what to build next
- TOOLS.md is the specification for every tool to implement
- UNIQUE.md explains why we are building what we are building
- COMPARISON.md is for reference — what the competition has
- archive/ is raw conversation data — reference, not instruction

## Communication

Claude writes implementation prompts. Cursor receives them and codes. Hermes tests and verifies.

If Claude finds an ambiguity in a spec, Claude resolves it and documents the decision. Do not ask Laud to decide minor implementation details.

If Cursor hits a limitation, document it and hand off to Claude for a revised prompt.

If Hermes finds a bug during testing, report it to Claude with exact error messages and stack traces.

## Hard constraints

- No emojis in code, comments, commits, or docs
- No em-dashes anywhere
- MIT license on all code
- Every tool must have a test
- Every phase must ship something working

## Current phase

Phase 1: Property Agent with Security
- Stabilize the existing Propreneur-v2 Carina service
- Integrate Labyrinth Scout
- Ship carinaai.uk as working product
