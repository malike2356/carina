<?php

declare(strict_types=1);

use App\Services\Deals\Support\ListingUrlNormalizer;

it('strips common tracking query params', function (): void {
    $u = 'https://www.rightmove.co.uk/properties/123?utm_source=email&foo=bar';
    expect(ListingUrlNormalizer::normalize($u))->toBe('https://www.rightmove.co.uk/properties/123?foo=bar');
});

it('drops channel query param from zoopla-style urls', function (): void {
    $u = 'https://www.zoopla.co.uk/for-sale/details/1?channel=RES_BUY'; // channel is stripped per config
    expect(ListingUrlNormalizer::normalize($u))->toBe('https://www.zoopla.co.uk/for-sale/details/1');
});
