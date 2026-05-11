<?php

declare(strict_types=1);

use App\Services\Deals\ListingFeedDedupeKey;

it('prefers rightmove id when present', function (): void {
    $key = ListingFeedDedupeKey::fromNormalisedRow([
        'postcode' => 'M1 1AA',
        'rightmove_id' => '12345',
        'source_url' => 'https://www.rightmove.co.uk/x',
    ]);

    expect($key)->toBe('rightmove:12345');
});

it('falls back to zoopla id', function (): void {
    $key = ListingFeedDedupeKey::fromNormalisedRow([
        'postcode' => 'SW1A 1AA',
        'zoopla_id' => '987',
    ]);

    expect($key)->toBe('zoopla:987');
});

it('falls back to source url hash', function (): void {
    $url = 'https://www.onthemarket.com/details/abc';
    $key = ListingFeedDedupeKey::fromNormalisedRow([
        'postcode' => 'B1 1AA',
        'source_url' => $url,
    ], 'postcode_address_hash');

    expect($key)->toBe('url:'.sha1($url));
});
