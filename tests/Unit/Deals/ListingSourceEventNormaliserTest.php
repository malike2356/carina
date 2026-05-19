<?php

declare(strict_types=1);

use App\Models\Tenant\ListingSourceEvent;
use App\Services\Deals\ListingSourceEventNormaliser;

it('normalises listing event meta into sourcing score fields', function (): void {
    $event = new ListingSourceEvent([
        'meta' => [
            'asking_price' => '£180,000',
            'beds' => 3,
            'postcode' => 'm1 1aa',
            'property_type' => 'Terraced house',
            'gross_yield' => '8.2',
        ],
    ]);

    $result = app(ListingSourceEventNormaliser::class)->toScoringArray($event);

    expect($result)->not->toBeNull()
        ->and($result['price'])->toBe(180000.0)
        ->and($result['bedrooms'])->toBe(3)
        ->and($result['postcode'])->toBe('M11AA')
        ->and($result['strategy'])->toBe('btl')
        ->and($result['gross_yield'])->toBe(8.2);
});

it('returns null when a listing event has no price', function (): void {
    $event = new ListingSourceEvent([
        'meta' => [
            'beds' => 2,
            'postcode' => 'LS1 1AA',
        ],
    ]);

    expect(app(ListingSourceEventNormaliser::class)->toScoringArray($event))->toBeNull();
});
