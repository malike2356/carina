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
        'tenant.contacts.index' => 'CRM contacts list: search, filters, add contact.',
        'tenant.contacts.create' => 'CRM: creating a new contact record.',
        'tenant.contacts.edit' => 'CRM: editing an existing contact.',
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
    ],
];
