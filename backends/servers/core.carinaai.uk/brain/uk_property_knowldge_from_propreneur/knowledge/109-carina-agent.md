# Carina Agent

**Last updated:** 2026-05-17

## Overview
Carina is an AI agent that can execute multi-step tasks within your workspace autonomously. She can search and manage contacts, run property calculators, analyse deals, check compliance items, schedule mentoring sessions, generate deal packs, send communication sequences, and more - all within a conversation.

Available on Professional+ plans.

## Core Features
- **24 agent tools** - Search/create/update/delete contacts, run calculators (BTL, HMO, BRR, R2R, SA, Flip, Development), find strategies, manage deals and properties, check compliance, schedule mentoring, generate documents, send communications, and access accounting data
- **Multi-step task execution** - Carina plans, executes, compiles results, and delivers a coherent answer - all in one conversation
- **Confirmation gates** - Sensitive actions (generating deal packs, sending email sequences) require your approval before executing
- **Scheduled agent runs** - Proactive checks for compliance expiry, stale pipeline deals, and inactive contacts
- **Brain modifiers** - Load custom thinking styles: Deal Principal, Sharp Analyst, No Waffle, Legal Review, Investor View, Negotiation, Numbers & Tax, and more
- **Incognito mode** - Privacy mode that prevents Carina from learning from the conversation
- **Knowledge training** - Upload training documents (PDFs, images, DOCX, ZIP) to teach Carina about your specific content
- **Floating widget** - Persistent corner chat thread (one per user) for quick access

## Getting Started
1. Open a Carina conversation from the workspace
2. Choose a brain modifier that fits the task (e.g. "Investor View" for deal analysis)
3. Ask naturally - "Run a BTL calc on a 300k property" or "Find stale deals in my pipeline"
4. For sensitive actions, confirm when prompted
5. Use the floating widget for quick questions without leaving your page

## Key Workflows

### Multi-step deal research
Ask Carina to research a deal. She will: search contacts for the lead, run the calculator, write results to a scratchpad, check compliance requirements, and compile everything into a coherent summary - all in one response.

### Scheduled compliance check
Carina automatically checks all compliance items daily, identifies overdue and expiring items (within 30 days), and presents a digest. Stale deals (not updated in 14+ days) and inactive contacts (60+ days) can also be reviewed.

### Brain modifiers
Select a brain modifier before starting a conversation to change how Carina thinks:
- **Master** - CEO-level strategic view
- **Genius** - Sharp analytical breakdown
- **No Waffle** - Direct, no B.S. answers
- **Double Check** - Critical review mode
- **Legal** - Compliance and legal perspective
- **Coaching** - Mentor mode for guidance

### Incognito mode
Say "incognito mode" or "private mode" to prevent Carina from learning from the conversation. Useful for sensitive deal discussions. Say "back to normal" to resume learning.

## Business Rules
- Agent tasks have a maximum step limit (configurable 1-25, default 8)
- Confirmation gates expire after a configurable time (default 5 minutes)
- Rate limits apply: workspace-wide (500 per hour, 5,000 per day) and per-user (100 per hour, 1,000 per day)
- Knowledge training files are scanned for viruses before processing
- Incognito mode skips insight extraction and scratchpad persistence
- Scheduled agent runs are bounded - max 5 tool steps per run

## Best Practices
- Use brain modifiers to get the right thinking style for each task
- For complex multi-step tasks, state all your requirements in one message
- Use incognito mode for confidential deal discussions
- Train Carina on your documentation for better context-aware responses
- Set up scheduled agent runs for compliance and pipeline health monitoring

## Related Features
- **Lead Funnel** - Carina can qualify leads and trigger follow-ups
- **Deal Calculators** - Carina can run any of the 18 calculators
- **Compliance** - Scheduled compliance expiry checks
- **Mentoring OS** - Schedule sessions and track progress
