# Speed to Lead

**Last updated:** 2026-05-17

## Overview
Instantly capture, qualify, and route incoming leads. When a new lead arrives, Speed to Lead starts a qualification session - either via a form or an AI conversation with Carina - scores the lead, and routes it based on configurable rules. Track response times to monitor SLA performance.

## Core Features
- **Instant qualification** - Capture leads the moment they land, with automatic session creation
- **AI-powered qualification** - Carina can conduct a qualification conversation to assess lead quality
- **Forms** - Create qualification form templates with custom fields
- **Routing rules** - Define rules that assign leads to specific team members, trigger notifications, AI qualify, or fire webhooks
- **Public access** - Qualification sessions use a public token link (no login required)
- **Response time tracking** - Every action logs response time in seconds for SLA monitoring
- **Session lifecycle** - Leads move through pending, in-progress, completed, qualified, or disqualified

## Getting Started
1. Create qualification form templates for different lead types
2. Set up routing rules with priority ordering
3. Embed the qualification widget on your landing pages
4. Configure Carina AI qualification for high-value lead types
5. Monitor response times on the speed dashboard

## Key Workflows

### Form-based qualification
A visitor fills out a qualification form embedded on your landing page. The submission starts a session, the system creates or links a contact record, and routing rules are evaluated in priority order. The first matching rule fires its action.

### AI qualification conversation
For high-value leads, Carina can conduct a conversational qualification. The visitor answers questions conversationally, Carina scores and qualifies the lead, and the result is stored. The session can be resumed later via the public token link.

### Routing rules
Rules are evaluated in priority order. Each rule has conditions (matching lead attributes) and an action (assign to user, notify, AI qualify, or webhook). Time windows set response targets. Rules can be toggled on/off and reordered.

## Business Rules
- Routing rules evaluated in priority order - first match fires
- Qualification sessions are accessible via public link without login
- AI qualification results are stored for review alongside form answers
- Response time is measured in seconds from lead receipt to action execution
- Session status lifecycle: pending, in-progress, completed, qualified, or disqualified
- Qualification forms can be reused across multiple landing pages

## Best Practices
- Create separate qualification paths for investors vs tenants vs agents
- Set shorter response time targets for high-value leads
- Use Carina AI qualification for complex lead types that need conversation
- Review routing rules regularly - reorder by conversion performance
- Monitor the speed dashboard daily for SLA breaches

## Related Features
- **Lead Funnel** - Speed to Lead feeds qualified leads into the funnel
- **Carina Agent** - AI-powered qualification conversations
- **Comms & Engagement** - Automated follow-ups after qualification
