<?php

declare(strict_types=1);

use App\Services\Deals\Contracts\ListingImportDriverInterface;
use App\Services\Deals\Drivers\ChainListingImportDriver;
use App\Services\Deals\ListingImportService;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Http::preventStrayRequests();
    config([
        'listings.import_driver' => 'url',
        'listings.partner.enabled' => false,
        'listings.partner.base_url' => null,
        'listings.partner.token' => null,
        'listings.partner.auth_scheme' => 'bearer',
        'listings.partner.api_key_header' => 'X-Api-Key',
    ]);
    $app = app();
    $app->forgetInstance(ListingImportDriverInterface::class);
    $app->forgetInstance(ListingImportService::class);
    $app->forgetInstance(ChainListingImportDriver::class);
});

it('extracts listing data from json-ld on the fetched page', function (): void {
    $jsonLd = json_encode([
        '@context' => 'https://schema.org',
        '@type' => 'Product',
        'name' => '3-bed semi in Birmingham',
        'description' => 'A lovely semi-detached house.',
        'offers' => ['price' => 250000],
        'image' => ['https://example.com/img1.jpg'],
        'address' => [
            'streetAddress' => '12 High Street',
            'addressLocality' => 'Birmingham',
            'postalCode' => 'B1 1AA',
        ],
        'numberOfRooms' => 3,
    ]);

    Http::fake([
        'https://www.rightmove.co.uk/properties/12345' => Http::response(
            '<html><head><script type="application/ld+json">'.$jsonLd.'</script></head><body></body></html>',
            200,
        ),
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.rightmove.co.uk/properties/12345');

    expect($result['success'])->toBeTrue()
        ->and($result['import_driver'])->toBe('url')
        ->and($result['platform'])->toBe('rightmove')
        ->and($result['title'])->toBe('3-bed semi in Birmingham')
        ->and($result['price'])->toBe(250000.0)
        ->and($result['bedrooms'])->toBe(3)
        ->and($result['postcode'])->toBe('B1 1AA')
        ->and($result['address'])->toContain('High Street')
        ->and($result['images'])->toHaveCount(1);
});

it('falls back to og:meta when no json-ld is present', function (): void {
    $html = <<<'HTML'
<html><head>
<meta property="og:title" content="2-bed flat Zoopla" />
<meta property="og:description" content="A bright 2-bed flat." />
<meta property="og:image" content="https://example.com/flat.jpg" />
<meta property="og:price:amount" content="185000" />
</head><body></body></html>
HTML;

    Http::fake([
        'https://www.zoopla.co.uk/for-sale/details/67890' => Http::response($html, 200),
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.zoopla.co.uk/for-sale/details/67890');

    expect($result['success'])->toBeTrue()
        ->and($result['platform'])->toBe('zoopla')
        ->and($result['title'])->toBe('2-bed flat Zoopla')
        ->and($result['price'])->toBe(185000.0)
        ->and($result['images'])->toContain('https://example.com/flat.jpg');
});

it('returns success false when the request fails', function (): void {
    Http::fake([
        'https://www.rightmove.co.uk/*' => Http::response('', 403),
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.rightmove.co.uk/properties/99999');

    expect($result['success'])->toBeFalse()
        ->and($result)->toHaveKey('error');
});

it('returns success false when no extractable data is found', function (): void {
    Http::fake([
        'https://www.onthemarket.com/details/12345/' => Http::response('<html><body>No structured data here</body></html>', 200),
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.onthemarket.com/details/12345/');

    expect($result['success'])->toBeFalse();
});
