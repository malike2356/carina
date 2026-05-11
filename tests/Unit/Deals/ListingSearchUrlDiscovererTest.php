<?php

declare(strict_types=1);

use App\Services\Deals\ListingSearchUrlDiscoverer;

it('extracts rightmove property urls from search html', function (): void {
    $html = '<a href="https://www.rightmove.co.uk/properties/111">x</a> '
        .'<a href="https://www.rightmove.co.uk/properties/222#frag">y</a>';

    $d = new ListingSearchUrlDiscoverer(10);
    $urls = $d->extractFromHtml($html, 'https://www.rightmove.co.uk/property-for-sale/find.html');

    expect($urls)->toHaveCount(2)
        ->and($urls[0])->toBe('https://www.rightmove.co.uk/properties/111')
        ->and($urls[1])->toBe('https://www.rightmove.co.uk/properties/222');
});
