# Action Prompts — Write Cursor-Ready Build Prompts Here

## Your job

You are Claude. Your task is to convert the specification files in `prompt_description/` into actionable implementation prompts for Cursor. Write each one as a file in this directory.

## Input
Read every file in `../prompt_description/` organized by phase:

```
../prompt_description/
  phase1-core/         6 spec files
  phase2-tools/        8 spec files
  phase3-skills/       6 spec files
  phase4-workspace/    3 spec files
  phase5-advanced/     4 spec files
```

## Output
Write one action prompt per spec file into this directory, organized by phase:

```
action_prompts/
  phase1-core/         6 action prompts
  phase2-tools/        8 action prompts
  phase3-skills/       6 action prompts
  phase4-workspace/    3 action prompts
  phase5-advanced/     4 action prompts
```

## Format for each action prompt

Every action prompt must contain:

1. **Goal**: One sentence. What Cursor is building.
2. **Context**: What Cursor needs to know before starting (existing files, dependencies, conventions).
3. **Files to create/modify**: Exact file paths. Full paths from project root.
4. **Step-by-step**: Numbered. Each step is one concrete action Cursor can take.
5. **Expected behavior**: What the finished code should do.
6. **Test**: How Cursor verifies it worked before handing off to Claude for review.
7. **Dependencies**: What must exist before this task can start.

## Rules

- One action prompt per spec file. Do not combine multiple specs.
- Write for Cursor, not for a human. Cursor needs exact paths, exact commands, exact file contents.
- Include code snippets where the spec describes specific logic.
- Include edge cases from the spec's "pitfalls" or "what to verify" sections.
- Reference the project structure: propreneur-v2 is at /opt/lampp/htdocs/VERLOX/propreneur/propreneur-v2/.
- Reference CARINA_BUILD.md and AGENTS.md from the parent directory for project conventions.
- PHP files must have `declare(strict_types=1)`. Laravel 12. PHP 8.2+.
- Every file must pass `php -l` before being considered done.
- Write each prompt as if Cursor will execute it independently — no context from other prompts.

## Process

1. Read one spec file from `../prompt_description/{phase}/`
2. Understand what needs to be built
3. Check the project for existing files that will be modified
4. Write the action prompt to `action_prompts/{phase}/{filename}`
5. Move to the next spec file
6. Do not skip any spec file

## Order

Build in this order (dependencies matter):

Phase 1: 01-email-pipeline → 02-telegram-bot → 03-daily-briefing → 04-tts-delivery → 05-floor-plan → 06-scout-integration

Phase 2: 01-terminal → 02-process → 03-file-system → 04-execute-code → 05-browser → 06-delegate-task → 07-cronjob → 08-memory-session

Phase 3: Any order (skills are independent). 06-domain-pack-system last (depends on tools being registered).

Phase 4: 01-workspace-files → 02-heartbeat → 03-group-chat

Phase 5: 01-model-routing → 02-cross-agent → 03-scout-dashboard → 04-unique-marketplace

## Conventions

- No emojis in code, comments, or file contents
- No em-dashes anywhere
- Use `--` for options, not Unicode dashes
- All paths use forward slashes
- PHP namespace: App\Services\...
- Tests: Pest PHP (preferred) or PHPUnit
- Git: commit each completed task with descriptive message

## Example action prompt structure

```markdown
# Action: Terminal Tool Implementation

## Goal
Build the terminal tool that gives Carina shell execution capability.

## Context
- Project: Carina agent framework
- Language: PHP 8.2+ / Laravel 12 for service layer, Node.js for process execution
- Existing: CarinaAgentService.php, AbstractModuleToolHandler.php
- Convention: declare(strict_types=1) on every file

## Files to create
- app/Services/Carina/ToolHandlers/TerminalToolHandler.php
- app/Services/Carina/ProcessManager.php
- tests/Unit/TerminalToolHandlerTest.php

## Files to modify
- app/Services/Carina/CarinaToolRegistry.php (register handler)
- app/Services/Carina/CarinaAgentService.php (add TOOL_INSTRUCTION)

## Step-by-step

1. Create TerminalToolHandler.php extending AbstractModuleToolHandler
   - Tools: terminal
   - Parameters: command (required), background (bool), timeout (int), workdir (string), pty (bool)
   - handle() dispatches to runForeground() or runBackground()

2. Implement runForeground():
   - Use Symfony Process component
   - Execute command, capture output
   - Return ToolResult with output and exit code
   - Enforce timeout

3. Implement runBackground():
   - Spawn process via ProcessManager
   - Return ToolResult with session_id
   - ProcessManager tracks the process for later polling

4. Create ProcessManager.php
   - In-memory registry of running processes
   - Methods: start, poll, kill, getOutput

5. Register in CarinaToolRegistry.php
6. Add to TOOL_INSTRUCTION constant

## Expected behavior
- terminal("echo hello") → { output: "hello\n", exit_code: 0 }
- terminal("sleep 30", background=true) → { session_id: "proc_abc" }
- terminal("invalid_command") → { output: "command not found", exit_code: 127 }

## Test
- Create Pest test: TerminalToolHandlerTest
- Test foreground execution with echo
- Test background execution returns session_id
- Test timeout enforcement
- Test invalid command handling

## Dependencies
- Symfony Process component (composer require symfony/process)
```

## Verification

After writing all action prompts:
- Count: 27 files in total (6 + 8 + 6 + 3 + 4)
- Each file is a complete, self-contained build instruction
- Cursor could pick up any one file and build it without reading anything else
