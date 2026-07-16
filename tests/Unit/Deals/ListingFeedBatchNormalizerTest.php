<?php

declare(strict_types=1);

use App\Services\Deals\ListingFeedBatchNormalizer;

it('extracts items array from wrapper', function (): void {
    $items = ListingFeedBatchNormalizer::itemsFromResponse([
        'items' => [
            ['title' => 'A', 'postcode' => 'M1 1AA'],
        ],
    ]);

    expect($items)->toHaveCount(1)
        ->and($items[0]['title'])->toBe('A');
});

it('maps raw keys to normaliser input', function (): void {
    $mapped = ListingFeedBatchNormalizer::mapRawItem([
        'Title' => 'House',
        'post_code' => 'B1 1AA',
        'askingPrice' => 200000,
        'listingUrl' => 'https://www.rightmove.co.uk/properties/999',
        'rightmove_property_id' => '999',
        'photos' => ['https://cdn.example/a.jpg'],
    ]);

    expect($mapped['title'])->toBe('House')
        ->and($mapped['postcode'])->toBe('B1 1AA')
        ->and($mapped['price'])->toBe(200000)
        ->and($mapped['rightmove_id'])->toBe('999')
        ->and($mapped['images'])->toHaveCount(1);
});
