# Mentoring OS

**Last updated:** 2026-05-17

## Overview
A complete mentoring operating system for property entrepreneurship programmes. Manage mentor profiles, packages, programmes, cohorts, mentee intake, matching, relationships, goals and milestones, session notes, messaging, learning paths, and billing - all in one place.

## Core Features
- **Programme management** - Define programmes (e.g. "12-Week Property Deal Sourcing") with multiple cohorts
- **Mentor profiles** - Public-facing profiles with bio, specialties, pricing, and availability
- **Package configuration** - Create priced packages with session limits, durations, billing cycles, and linked learning paths
- **Mentee intake pipeline** - Public application forms with status tracking, payment collection, and auto-approval workflows
- **Mentor-mentee matching** - Browse, request, approve/reject, and manage relationships
- **Goal & milestone tracking** - Set SMART goals with milestones, evidence uploads, progress tracking
- **Session notes** - Record notes per session with action items and visibility controls (shared or mentor-only)
- **Internal messaging** - Private messaging between mentor and mentee within relationships
- **Learning path assignments** - Assign course sequences to mentees, track progress
- **Billing & invoicing** - Auto-generated invoices per billing cycle, Stripe payment collection
- **Cohort management** - Time-boxed groups with member management
- **Reports** - Summary stats, leaderboards, at-risk detection, cohort performance

## Getting Started
1. Set up your mentor profile - bio, specialties, pricing, availability
2. Create programmes and packages with session quotas and pricing
3. Publish intake forms - mentees apply, you review and approve
4. Manage relationships - track sessions, goals, and milestones
5. Billing runs automatically based on your package configuration

## Key Workflows

### Mentee intake pipeline
A prospective mentee fills out a public application form. The application moves through stages: pending, awaiting payment (if applicable), paid, approved (creates a contact record and mentoring relationship), or rejected. Each application gets a unique status token so the applicant can check progress without logging in.

### Session management
After each mentoring session (booked via the calendar), record session notes with an optional summary and action items. Notes can be marked as "shared" (visible to both) or "mentor only" (private). Action items are toggle-able checkboxes for follow-up tracking.

### Goal tracking
Create goals within a relationship with target dates and progress percentage. Add milestones as checkpoints - each milestone supports text evidence and file uploads. Milestones auto-calculate overdue status. Goals can move through pending, in-progress, achieved, or abandoned.

### Billing & invoicing
Invoices are auto-generated per billing cycle based on the package terms. Mentees pay via Stripe Checkout. Track payment status, session quotas used vs allowed, and next invoice dates.

## Business Rules
- Session quotas track sessions_used vs sessions_allowed per package
- Mentor-only session notes are hidden from mentees
- Goals show overdue status automatically based on target dates
- Billing is recurring - next_invoice_at drives invoice generation
- Mentees can be in multiple cohorts across different programmes
- Public application registration works without login (status token)

## Best Practices
- Define clear programme outcomes before creating packages
- Use milestones for major checkpoints and session notes for weekly touchpoints
- Set realistic session quotas - better to offer fewer sessions with the option to extend
- Enable "accepts free discovery" on your mentor profile to attract more applicants
- Review at-risk reports weekly to catch mentees falling behind

## Related Features
- **Community & Learning** - Learning paths, courses, and quizzes complement mentoring
- **Subscriptions & Billing** - Stripe integration for payment processing
- **Pipeline Automation** - Deal-focused mentoring can link to pipeline deals
