<?php

declare(strict_types=1);

/**
 * PropertyData.co.uk API catalogue for Due Diligence and Market Intelligence.
 *
 * @see https://propertydata.co.uk/api/documentation
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Postcode parallel endpoints (fetched on every full due diligence run)
    |--------------------------------------------------------------------------
    */
    /*
    | These are fetched in batches of 4 (respecting the 4-calls/10-second rate limit).
    | Valuation endpoints are intentionally excluded — they are fetched sequentially in
    | PropertyDataDueDiligenceBundleService::build() so their cache keys stay clean.
    */
    'postcode_parallel' => [
        'demographics',
        'population',
        'crime',
        'schools',
        'agents',
        'politics',
        'household-income',
        'council-tax',
        'property-types',
        'tenure-types',
        'area-type',
        'internet-speed',
        'planning-applications',
        'flood-risk',
        'conservation-area',
        'green-belt',
        'national-park',
        'aonb',
        'listed-buildings',
        'national-hmo-register',
        'demand',
        'demand-rent',
        'growth',
        'growth-psf',
        'national-data',
        'prices',
        'prices-per-sqf',
        'sold-prices-per-sqf',
        'rents-hmo',
        'rents-commercial',
        'lha-rate',
        'restaurants',
        'ptal',
        'build-cost',
        'development-gdv',
        'mortgage-rates',
        'floor-areas',
        'energy-efficiency',
    ],

    /** Endpoints that accept a bedrooms parameter with postcode. */
    'bedroom_params' => [
        'rents-hmo',
        'rents-commercial',
        'demand-rent',
        'lha-rate',
    ],

    /** Endpoints that use full property valuation inputs (fetched sequentially, not in pool). */
    'valuation_params' => [
        'valuation-sale',
        'valuation-hmo',
        'valuation-rent',
        'valuation-historical',
        'valuation-commercial-rent',
        'valuation-commercial-sale',
    ],

    /*
    |--------------------------------------------------------------------------
    | Human labels for bundle section keys (UI)
    |--------------------------------------------------------------------------
    */
    'section_labels' => [
        'demographics' => 'Demographics',
        'population' => 'Population',
        'crime' => 'Crime',
        'schools' => 'Schools',
        'agents' => 'Estate agents',
        'politics' => 'Politics',
        'household_income' => 'Household income',
        'council_tax' => 'Council tax',
        'property_types' => 'Property types mix',
        'tenure_types' => 'Tenure mix',
        'area_type' => 'Area type',
        'internet_speed' => 'Internet speed',
        'planning_applications' => 'Planning applications',
        'flood_risk' => 'Flood risk',
        'conservation_area' => 'Conservation area',
        'green_belt' => 'Green belt',
        'national_park' => 'National park',
        'aonb' => 'Area of outstanding natural beauty',
        'listed_buildings' => 'Listed buildings',
        'national_hmo_register' => 'National HMO register',
        'demand' => 'Sale demand',
        'demand_rent' => 'Rental demand',
        'growth' => 'Capital growth',
        'growth_psf' => 'Capital growth (£/sq ft)',
        'national_data' => 'National benchmarks',
        'prices' => 'Asking prices',
        'prices_per_sqf' => 'Asking price per sq ft',
        'sold_prices_per_sqf' => 'Sold price per sq ft',
        'rents_hmo' => 'HMO rents',
        'rents_commercial' => 'Commercial rents',
        'lha_rate' => 'LHA rate',
        'restaurants' => 'Restaurants',
        'ptal' => 'PTAL (London transport)',
        'build_cost' => 'Build cost',
        'development_gdv' => 'Development GDV',
        'mortgage_rates' => 'Mortgage rates',
        'valuation_rent' => 'Rental valuation',
        'valuation_hmo' => 'HMO valuation',
        'valuation_sale' => 'Sale valuation (API)',
        'valuation_historical' => 'Historical valuation',
        'valuation_commercial_rent' => 'Commercial rent valuation',
        'valuation_commercial_sale' => 'Commercial sale valuation',
        'floor_areas' => 'Floor areas',
        'energy_efficiency' => 'Energy efficiency (area)',
        'rent_estimate' => 'Long-let rent estimate',
        'average_yields' => 'Gross yields',
        'valuation' => 'AVM / area value',
        'sold_prices' => 'Sold prices (Land Registry)',
        'sourced_properties' => 'On-market listings',
        'freeholds' => 'Freehold titles',
        'uprns' => 'UPRNs in postcode',
        'uprn' => 'UPRN details',
        'uprn_title' => 'UPRN title',
        'title' => 'Title register',
        'title_use_class' => 'Title use class',
        'analyse_buildings' => 'Building analysis',
        'land_registry_documents' => 'Land Registry documents',
        'site_plan_documents' => 'Site plan documents',
        'rebuild_cost' => 'Rebuild cost',
        'stamp_duty_calculator' => 'Stamp duty calculator',
        'mortgage_calculator' => 'Mortgage calculator',
        'development_calculator' => 'Development calculator',
        'account_credits' => 'API credits remaining',
        'account_documents' => 'Purchased documents',
        'calculator_prefill' => 'Calculator prefill (derived)',
        'postcode_key_stats' => 'Postcode district rankings (region)',
        'sourced_property' => 'Sourced listing detail',
        'titles_by_company' => 'Titles by company',
        'address_match_uprn' => 'Address to UPRN match',
        'george' => 'George AI (PropertyData)',
    ],

    /** Sections excluded from the "Complete data" browser (internal / duplicate). */
    'section_hidden' => [
        'calculator_prefill',
    ],

    /**
     * UK regions for /postcode-key-stats (30 credits per request).
     *
     * @see https://propertydata.co.uk/api/documentation/regions
     */
    'regions' => [
        'london' => 'London',
        'south_east' => 'South East',
        'south_west' => 'South West',
        'east' => 'East of England',
        'east_midlands' => 'East Midlands',
        'west_midlands' => 'West Midlands',
        'yorkshire_and_the_humber' => 'Yorkshire and The Humber',
        'north_west' => 'North West',
        'north_east' => 'North East',
        'scotland' => 'Scotland',
        'wales' => 'Wales',
        'northern_ireland' => 'Northern Ireland',
    ],

    /*
    |--------------------------------------------------------------------------
    | Platform-subsidised PropertyData (trial / freemium preview before BYOK)
    |--------------------------------------------------------------------------
    */
    'platform_access' => [
        'subsidy_enabled_default' => filter_var(env('PROPERTYDATA_PLATFORM_SUBSIDY_DEFAULT', true), FILTER_VALIDATE_BOOL),
        'trial_due_diligence_runs' => (int) env('PROPERTYDATA_PLATFORM_TRIAL_DD_RUNS', 3),
        'free_due_diligence_runs' => (int) env('PROPERTYDATA_PLATFORM_FREE_DD_RUNS', 1),
        'byok_preview_due_diligence_runs' => (int) env('PROPERTYDATA_PLATFORM_BYOK_PREVIEW_DD_RUNS', 2),
        'low_balance_threshold' => (int) env('PROPERTYDATA_PLATFORM_LOW_BALANCE', 1),
        'lifetime_ttl_seconds' => (int) env('PROPERTYDATA_PLATFORM_LIFETIME_TTL', 34_560_000),
    ],

];
