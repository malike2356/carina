<?php

declare(strict_types=1);

/**
 * Optional one-line hints keyed by Laravel route name. Shown to Carina when the client
 * sends matching page_context.route (floating widget or API chat). Extend as screens ship.
 *
 * @var array<string, string>
 */
return [
    'route_hints' => [
        'tenant.dashboard' => 'Workspace home: KPI cards, shortcuts to modules, recent activity.',
        'tenant.onboarding.entry' => 'Workspace onboarding wizard: completing setup steps before full access.',
        'tenant.vical.index' => 'viCal booking hub: public booking slug, event types, weekly availability, blackouts, approve or reject pending bookings.',
        'tenant.contacts.index' => 'People directory: search, filters, add a person.',
        'tenant.contacts.create' => 'Creating a new person record.',
        'tenant.contacts.edit' => 'Editing an existing person record.',
        'tenant.contacts.show' => 'Person profile: timeline, intake stage, scores, linked deals; log outcomes after calls or visits.',
        'tenant.properties.index' => 'Portfolio properties list: add property, filters, strategy badges.',
        'tenant.properties.create' => 'Portfolio: new property form (address, strategy, financials).',
        'tenant.properties.edit' => 'Portfolio: editing a property record.',
        'tenant.deals.index' => 'Deal Engine list: deal analyses, filters, open a deal workspace.',
        'tenant.deals.create' => 'Deal Engine: starting a new deal analysis.',
        'tenant.deals.show' => 'Deal Engine: single deal analysis, metrics, Carina deep links.',
        'tenant.pipelines.index' => 'Pipeline: list of boards; pick a pipeline to open Kanban.',
        'tenant.pipelines.show' => 'Pipeline Kanban: stages, cards, drag between stages.',
        'tenant.compliance.index' => 'Compliance hub: checklist items, due dates, statuses.',
        'tenant.accounting.index' => 'Accounting hub: journals, chart, trial balance, P&L entry points.',
        'tenant.reporting.index' => 'Reporting hub: definitions, scheduled exports, KPI entry.',
        'tenant.carina.index' => 'Carina: list of past conversations; start new chats.',
        'tenant.carina.show' => 'Carina full-page chat: sidebar conversations, composer, same thread as floating widget if context matches.',
        'tenant.workspace-subscriptions.index' => 'Workspace billing and subscription: plan, seats, Stripe portal.',
        'tenant.lead-funnel.index' => 'Marketing intake hub: overview stats, segments, intake stages, deep links into people with filters; triage who needs follow-up.',
        'tenant.communications.index' => 'Communications hub home: sequences and broadcast entry points; check enrolments and consent before sending.',
        'tenant.communications.enrollments' => 'Sequence enrolments: who is on which sequence, pause or adjust before changing live copy.',
        'tenant.communications.sequences.create' => 'New message sequence: define steps, delays, channels; align with legitimate interest and opt-out handling.',
        'tenant.communications.sequences.edit' => 'Edit sequence: review each step, test sends, watch for duplicate enrolments.',
        'tenant.investors.overview' => 'Investors workspace overview: journey snapshot, priorities, links into pipeline and KYC.',
        'tenant.investors.pipeline' => 'Investor pipeline board: move cards when status changes; note next human touch and documents due.',
        'tenant.investors.funnel' => 'Investor funnel view: stage counts; use to spot stuck prospects and assign follow-up.',
        'tenant.investors.report' => 'Investor workspace report: export-friendly snapshot; verify numbers against people records before external sharing.',
        'tenant.investors.power-team' => 'Power team dashboard: internal roles supporting investors; clarify responsibilities and handoffs.',
        'tenant.investors.power-team.directory' => 'Power team directory: who covers legal, tax, brokers; use before escalating externally.',
        'tenant.investors.kyc.show' => 'Investor KYC for one person: ID checks, source of funds, risk notes; do not shortcut regulated steps.',
        'tenant.community.index' => 'Community hub: posts and engagement; moderate tone and keep landlord compliance in mind.',
        'tenant.lms.index' => 'Learning home: courses and paths; assign or resume training for staff consistency.',
        'tenant.lms.courses.show' => 'Course view: modules and progress; pair with operational checklists from lessons.',
        'tenant.lms.learning-paths.show' => 'Learning path: ordered modules; use for onboarding new team members.',
        'tenant.mentoring.index' => 'Mentoring OS hub: mentor and mentee surfaces; align sessions with goals and actions.',
        'tenant.mentoring.portal' => 'Mentee portal: tasks and resources; keep advice practical and logged where the product allows.',
        'tenant.mentoring.onboarding.start' => 'Mentee onboarding start: collect goals and constraints before scheduling heavy sessions.',
        'tenant.settings.automation.index' => 'Workspace automation rules: triggers and actions; test on a narrow cohort before broad enable.',
        'tenant.settings.automation.runs' => 'Automation run log: confirm executions, failures, and rate limits after changes.',
        'tenant.vical.calendar' => 'viCal calendar: internal view of bookings; resolve clashes before promising external times.',
        'tenant.vical.analytics' => 'viCal analytics: conversion and no-show signals; adjust availability or reminders accordingly.',
        'tenant.vical.bookings.show' => 'Single booking: approve, reject, notes, recordings; confirm identity-sensitive details carefully.',
        'tenant.vical.group-events.index' => 'Group events: capacity and registrations; export CSV before bulk comms.',
        'tenant.reporting.reports' => 'Reporting list: run or schedule exports; validate filters against the question being answered.',
    ],
];
