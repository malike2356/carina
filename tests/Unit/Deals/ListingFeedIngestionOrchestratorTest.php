<?php

declare(strict_types=1);

use App\Services\Deals\ListingFeedIngestionOrchestrator;

it('reports when no commercial programme is enabled', function (): void {
    config([
        'listings.commercial.rightmove_rtdf.enabled' => false,
        'listings.commercial.zoopla_partner.enabled' => false,
    ]);

    $orch = app(ListingFeedIngestionOrchestrator::class);

    expect($orch->anyCommercialProgrammeConfigured())->toBeFalse();
});

it('reports when a commercial programme is enabled', function (): void {
    config([
        'listings.commercial.rightmove_rtdf.enabled' => true,
    ]);

    $orch = app(ListingFeedIngestionOrchestrator::class);

    expect($orch->anyCommercialProgrammeConfigured())->toBeTrue();
});

it('poll is disabled by default', function (): void {
    config(['listings.ingestion.poll_enabled' => false]);

    expect(app(ListingFeedIngestionOrchestrator::class)->pollEnabled())->toBeFalse();
});
