<?php

declare(strict_types=1);
use App\Services\Accounting\Contracts\AccountingProviderFactory;

/**
 * Per-provider copy for the accounting integrations screen (UK context).
 * Keys must match {@see AccountingProviderFactory} registry.
 *
 * @var array<string, array{
 *     headline: string,
 *     body: string,
 *     docs_url: string,
 *     oauth_notes: list<string>,
 *     after_connect: list<string>,
 * }>
 */
return [
    'zoho_books' => [
        'headline' => 'Zoho Books',
        'body' => 'OAuth connects this workspace to Zoho Books. Posted journals can be pushed as invoice-shaped payloads; pulled sales invoices create draft GL journals with integration_metadata.',
        'docs_url' => 'https://www.zoho.com/books/api/v3/',
        'oauth_notes' => [
            'You will be redirected to Zoho to approve access; the workspace stores encrypted tokens only.',
            'Organisation is selected during connect; set default_customer_id in integration settings when the API requires a customer on outbound invoices.',
        ],
        'after_connect' => [
            'Use Push from this page or post a journal in Propreneur � a background job syncs to Zoho when connected.',
            'Use Pull to import invoices modified since last sync.',
        ],
    ],
    'xero' => [
        'headline' => 'Xero',
        'body' => 'UK MTD-capable cloud ledger. Propreneur maps posted journals to Xero manual journals / bank lines via the same integration_metadata contract once OAuth is enabled.',
        'docs_url' => 'https://developer.xero.com/documentation/api/accounting/overview',
        'oauth_notes' => [
            'Standard Xero OAuth 2.0 (authorisation code); tenant organisation is bound after consent.',
            'Store xero_tenant_id in settings after connect for API scoping.',
        ],
        'after_connect' => [
            'Map Propreneur GL codes to Xero account codes using integration_metadata.external_account_code per line when implemented.',
        ],
    ],
    'sage' => [
        'headline' => 'Sage (Business Cloud Accounting / Intacct APIs)',
        'body' => 'Sage is widely used by UK practices. The connector uses the same OAuth + push/pull contract; journal payloads align with Sage journal entry models when the driver is completed.',
        'docs_url' => 'https://developer.sage.com/api/accounting/api/',
        'oauth_notes' => [
            'Business vs developer sandbox: use Sage developer portal redirect URIs registered for this app.',
        ],
        'after_connect' => [
            'Use CSV exports as an interim bridge until API journal posting is live.',
        ],
    ],
    'freeagent' => [
        'headline' => 'FreeAgent',
        'body' => 'Popular with UK contractors and small landlords. Explains and bills categories map cleanly to Propreneur expense categories for export.',
        'docs_url' => 'https://dev.freeagent.com/docs/explaining_transactions',
        'oauth_notes' => [
            'OAuth redirect must match the URL registered in your FreeAgent application.',
        ],
        'after_connect' => [
            'Explains (bank explanations) and bills endpoints are the primary targets for push/pull.',
        ],
    ],
    'quickbooks' => [
        'headline' => 'QuickBooks Online',
        'body' => 'QuickBooks Online (UK edition) uses OAuth 2.0. Journals map to QBO JournalEntry entities with DocNumber and Line detail.',
        'docs_url' => 'https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/journalentry',
        'oauth_notes' => [
            'Realm ID is stored in integration settings after connect for all API calls.',
        ],
        'after_connect' => [
            'Minor units in Propreneur are pence; QBO amounts are in pounds with decimal precision on sync.',
        ],
    ],
];
