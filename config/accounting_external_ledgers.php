<?php

declare(strict_types=1);
use App\Services\Accounting\Contracts\AccountingProviderFactory;

/**
 * UK-relevant external accounting systems beyond the first-class OAuth connectors
 * registered in {@see AccountingProviderFactory}.
 *
 * These entries are informational for UI, Carina, and API catalog responses until
 * dedicated IntegrationProvider cases and drivers are added.
 *
 * @var array{
 *     roadmap_uk: list<array{slug: string, name: string, notes: string}>,
 * }
 */
return [
    'roadmap_uk' => [
        [
            'slug' => 'clearbooks',
            'name' => 'Clear Books',
            'notes' => 'UK-focused SME cloud bookkeeping; typical bridge is CSV / manual journal export.',
        ],
        [
            'slug' => 'crunch',
            'name' => 'Crunch',
            'notes' => 'UK contractor accounting; align categories with workspace expense types before export.',
        ],
        [
            'slug' => 'dext',
            'name' => 'Dext (Receipt Bank)',
            'notes' => 'Receipt capture; pair with a ledger connector or CSV handoff from Propreneur expense receipts.',
        ],
        [
            'slug' => 'capium',
            'name' => 'Capium',
            'notes' => 'UK practice software; MTD-focused practices often need CSV trial balance / journal bridges.',
        ],
    ],
];
