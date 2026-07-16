<?php

declare(strict_types=1);

/**
 * Market intelligence hub: tool cards, workspace shortcuts, and optional per-tool
 * paths on the PropertyData public research site (see services.propertydata.public_research_url).
 *
 * Live postcode figures in the app use the PropertyData API via PropertyDataService
 * (platform key, tenant BYOK, or .env fallback).
 */
return [
    /*
    |--------------------------------------------------------------------------
    | Tool cards (hub + sidebar)
    |--------------------------------------------------------------------------
    | `research_path`: optional path on the PropertyData public research site (national tools).
    | `dd_tab`: optional Due Diligence hub tab (`identity`, `valuation`, `rental`, `epc`, `area`, `signals`, `land`, `calculators`).
    | `external_only`: when true, the card links out to PropertyData (UK-wide maps / rankings). Postcode tools use `dd_tab` instead.
    */
    'tools' => [
        [
            'id' => 'overview',
            'label' => 'Overview',
            'description' => 'Summary of UK market intelligence tools and how they map to Propreneur.',
            'research_path' => '',
        ],
        [
            'id' => 'live-map',
            'label' => 'Market live map',
            'description' => 'Postcode map, district prices and demand for your search. UK-wide choropleth stays on PropertyData.',
            'dd_tab' => 'identity',
        ],
        [
            'id' => 'strategy-heat-map',
            'label' => 'Strategy heat map',
            'description' => 'Find the best areas for BTL, HMO, BRRR, flip and SA strategies at a glance.',
            'dd_tab' => 'rental',
        ],
        [
            'id' => 'postcode-explorer',
            'label' => 'Postcode explorer',
            'description' => 'Deep dive into any postcode: demographics, crime, schools, planning and flood risk.',
            'dd_tab' => 'area',
        ],
        [
            'id' => 'postcode-rankings',
            'label' => 'Postcode rankings',
            'description' => 'Sortable leaderboard of UK postcode districts by yield, price, BTL score and more.',
            'external_only' => true,
            'research_path' => '',
        ],
        [
            'id' => 'last-sold-prices-map',
            'label' => 'Last sold prices map',
            'description' => 'Sold price history, chart and comparables for the postcode you enter.',
            'dd_tab' => 'valuation',
        ],
        [
            'id' => 'stock-tracker',
            'label' => 'Stock tracker',
            'description' => 'Track property lifecycle: new listings, STC, sold and removed over time.',
            'dd_tab' => 'signals',
        ],
        [
            'id' => 'price-trends',
            'label' => 'Price trends',
            'description' => 'Historical asking and sold price charts for your postcode.',
            'dd_tab' => 'valuation',
        ],
        [
            'id' => 'capital-growth',
            'label' => 'Capital growth',
            'description' => 'Capital growth by period and investment signals for your postcode.',
            'dd_tab' => 'signals',
        ],
        [
            'id' => 'planning-constraints',
            'label' => 'Planning constraints',
            'description' => 'Conservation, green belt, flood risk, listed buildings and planning applications.',
            'dd_tab' => 'land',
        ],
    ],

    /**
     * In-app shortcuts shown on the hub (Deal Engine).
     *
     * @var list<array{label: string, description: string, route: string}>
     */
    'workspace_shortcuts' => [
        [
            'label' => 'Due diligence hub',
            'description' => 'Full postcode property intelligence: valuation, EPC, area risks, planning and calculators.',
            'route' => 'tenant.due-diligence.index',
        ],
        [
            'label' => 'Area profiles',
            'description' => 'Named sourcing bundles with optional map pins for your patch.',
            'route' => 'tenant.deals.sourcing.profiles.index',
        ],
        [
            'label' => 'Sourcing workspace',
            'description' => 'Criteria, shortlists, inbox and manual search.',
            'route' => 'tenant.deals.sourcing.manual-search',
        ],
        [
            'label' => 'Deal analyses',
            'description' => 'Open a deal, then use Market intelligence in the deal header for postcode-level charts.',
            'route' => 'tenant.deals.index',
        ],
    ],
];
