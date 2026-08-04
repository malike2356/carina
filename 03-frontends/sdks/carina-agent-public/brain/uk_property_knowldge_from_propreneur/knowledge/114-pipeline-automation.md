# Pipeline Automation

**Last updated:** 2026-05-17

## Overview
Automate your deal pipeline with stage transition triggers, preset pipeline templates, and an immutable activity log. Automations fire when deals enter or exit stages, or when due dates pass. Pipeline presets let you quickly set up deal pipelines for different business lines.

## Core Features
- **Stage automations** - Trigger actions when deals enter, exit, or stay in a stage; also when stage due dates pass
- **Action types** - Assign users, send notifications, update deal fields, fire webhooks, or create tasks
- **Pipeline presets** - Pre-configured pipeline templates with named stages, colours, and default tags
- **Activity logging** - Every deal change is recorded immutably: stage changes, value updates, assignments, wins, losses
- **Toggle control** - Enable/disable automations without deleting them

## Getting Started
1. Set up your pipeline stages if you haven't already
2. Create automations for key transitions - e.g., when a deal enters "Qualified", assign to a senior negotiator
3. Use pipeline presets to standardise deal workflows across your team
4. Review the activity log to track deal history

## Key Workflows

### Creating a stage automation
Select a trigger: when a deal enters a stage, exits a stage, stays in a stage, or its stage due date passes. Choose the action: assign the deal to a team member, send a notification, update a deal field, fire a webhook, or create a task. Configure action parameters and toggle active.

### Using pipeline presets
Apply a preset to quickly set up a deal pipeline. System presets cannot be deleted but can be deactivated. Create your own presets to standardise workflows - e.g., a "Sales" pipeline with stages: Lead, Qualified, Offer, Under Offer, Exchanged, Completed.

### Reviewing deal activity
Every change to a deal is logged chronologically - creation, stage changes, value updates, assignment changes, notes, and deal outcomes. The activity log is immutable (once written, never modified), giving you a reliable audit trail.

## Business Rules
- Automations fire on stage transitions: deal_enters_stage, deal_exits_stage, deal_stays_in_stage, stage_due_date_passed
- System presets (built-in) cannot be deleted, but can be deactivated
- Activity logs are immutable - created once and never modified (no updates)
- Stage changes capture both from-stage and to-stage for full audit
- Automations can be toggled on/off without losing configuration

## Best Practices
- Set up notification automations for high-value deal stages
- Use presets to ensure consistent pipelines across team members
- Review the activity log before major deal decisions
- Create separate presets for different property strategies (BTL vs flip vs development)
- Automate task creation when deals move to legal/completion stages

## Related Features
- **Lead Funnel** - Lead funnel automation for pre-deal contacts
- **Workspace Automation** - General purpose automation outside the pipeline
- **Projects & Tasks** - Tasks created by automations feed into your task management
