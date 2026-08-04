# Comms & Engagement

**Last updated:** 2026-05-17

## Overview
Automated communication sequences, reusable email templates, and in-app notifications. Build multi-step drip campaigns that nurture leads, onboard new clients, or follow up after property viewings. Enrol contacts in sequences and track their progress through each step.

## Core Features
- **Communication sequences** - Multi-step drip campaigns with timed delays between steps
- **Step types** - Send email, send SMS, wait, tag contact, remove tag, or fire webhook
- **Email templates** - Reusable HTML templates with variable interpolation (first name, segment, source)
- **Contact enrollment** - Enrol contacts in sequences, track status (active, paused, completed, unsubscribed)
- **In-app notifications** - Per-user notifications with action deep links and read tracking
- **Built-in templates** - Pre-configured system templates ready to use

## Getting Started
1. Create email templates for your common message types
2. Build sequences with steps and delays between them
3. Enrol contacts manually or via automations
4. Track enrollment progress through completion
5. Use in-app notifications for internal team updates

## Key Workflows

### Building a drip sequence
Create a sequence with a name, description, and trigger. Add steps in order - each step has a delay (in days after the previous step) and an action type. Example: Day 1: send welcome email, Day 3: send follow-up, Day 7: if no response, send different message.

### Enrolling contacts
Enrol individual contacts or groups into sequences. Track their status: active (moving through steps), paused (temporarily stopped), completed (all steps done), or unsubscribed (opted out).

### Template variables
Templates support variable interpolation for personalisation: {{first_name}}, {{segment}}, {{source}}, {{cta_url}}. Variables are replaced automatically when the email is sent.

### In-app notifications
Notifications appear within the workspace with title, body, and an optional deep link action URL. Mark as read when done. Filter by read/unread status.

## Business Rules
- Each step has a delay in days offset from the previous step
- Multiple delays allow wait steps between actions
- Template variables are replaced at send time
- Unsubscribed contacts stop receiving further steps
- Built-in templates cannot be deleted
- In-app notifications are per-user with read tracking

## Best Practices
- Keep sequences short - 3-5 steps max for most campaigns
- Use variable personalisation in every email template
- Test enrollment flows with a small group before mass sending
- Monitor completion rates - if they're low, shorten your sequences
- Use the pause/resume feature for seasonal campaigns
- Segment your audience for better targeting in sequences

## Related Features
- **Lead Funnel** - Automations can enroll contacts in sequences
- **Carina Agent** - Carina can send communication sequences (with confirmation)
- **Subscriptions & Billing** - Communicating with subscribers
