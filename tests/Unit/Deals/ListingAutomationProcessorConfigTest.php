<?php

declare(strict_types=1);

use App\Services\Deals\ListingAutomationProcessor;

it('reflects listings.automation.enabled', function (): void {
    config(['listings.automation.enabled' => false]);
    expect(app(ListingAutomationProcessor::class)->enabled())->toBeFalse();

    config(['listings.automation.enabled' => true]);
    expect(app(ListingAutomationProcessor::class)->enabled())->toBeTrue();
});
