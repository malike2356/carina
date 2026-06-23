# Workspace Automation

**Last updated:** 2026-05-17

## Overview
General-purpose automation engine for workspace operations. Create trigger-action rules that automate workflows beyond pipeline and lead funnel automation. Workspace automation handles events, conditions, and sequential actions for any workspace process.

## Core Features
- **Trigger-action rules** - Define what event triggers automation and what actions follow
- **Condition evaluation** - Rules check conditions against trigger context before firing
- **Sequential actions** - Rules can execute multiple actions in sequence
- **Priority ordering** - Rules are evaluated in priority order
- **Execution logging** - Every rule execution is logged with status and results
- **Built-in rules** - System-provided automation rules (cannot be deleted)

## Getting Started
1. Identify repetitive workspace tasks you want to automate
2. Create a rule with the trigger event and any conditions
3. Configure one or more actions to execute
4. Set the rule priority and activate it
5. Review the execution log to confirm it's working

## Key Workflows

### Creating an automation rule
Choose an event trigger, add conditions that must be met (all conditions must match), and define the action(s) to execute. Rules are evaluated in sort order priority. Built-in rules are pre-configured and cannot be deleted.

### Reviewing execution history
The run log shows each time a rule fired - the trigger that activated it, the context data, the result, and any error messages. Failed runs show error details for troubleshooting.

## Business Rules
- Rules evaluated in priority order (sort_order)
- All conditions must match for the rule to fire
- Actions execute sequentially within a rule
- Built-in rules cannot be deleted
- Execution history is retained for review

## Best Practices
- Keep rule priorities intentional - put more specific rules at higher priority
- Test new rules with a limited scope before enabling widely
- Monitor the execution log for failures after creating new rules
- Document what each automation rule does for your team
- Review and clean up inactive rules periodically

## Related Features
- **Pipeline Automation** - Deal pipeline-specific automation
- **Lead Funnel** - Lead-focused automation engine
- **Comms & Engagement** - Communication sequences triggered by automation
