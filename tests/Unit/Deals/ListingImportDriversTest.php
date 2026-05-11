<?php

declare(strict_types=1);

use App\Services\Deals\Contracts\ListingImportDriverInterface;
use App\Services\Deals\ListingImportService;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Http::preventStrayRequests();
    config([
        'listings.import_driver' => 'url',
        'listings.partner.enabled' => false,
        'listings.partner.base_url' => null,
        'listings.partner.token' => null,
        'listings.partner.import_path' => '/listings/import',
        'listings.partner.url_field' => 'url',
        'listings.partner.auth_scheme' => 'bearer',
        'listings.partner.api_key_header' => 'X-Api-Key',
    ]);
    $app = app();
    $app->forgetInstance(ListingImportDriverInterface::class);
    $app->forgetInstance(ListingImportService::class);
});

it('uses partner driver when configured and maps JSON response', function (): void {
    config([
        'listings.import_driver' => 'partner',
        'listings.partner.enabled' => true,
        'listings.partner.base_url' => 'https://api.partner.test/v1',
        'listings.partner.token' => 'secret-token',
        'listings.partner.import_path' => '/listings/import',
        'listings.partner.url_field' => 'listing_url',
    ]);

    Http::fake([
        'https://api.partner.test/v1/listings/import' => Http::response([
            'success' => true,
            'data' => [
                'title' => 'Via partner',
                'price' => 300000,
                'images' => ['https://cdn.example/a.jpg'],
                'postcode' => 'M1 1AA',
            ],
        ], 200),
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.rightmove.co.uk/properties/1');

    expect($result['success'])->toBeTrue()
        ->and($result['import_driver'])->toBe('partner')
        ->and($result['title'])->toBe('Via partner')
        ->and($result['price'])->toBe(300000.0)
        ->and($result['images'])->toHaveCount(1);
});

it('returns configuration error when partner driver is selected but not configured', function (): void {
    config([
        'listings.import_driver' => 'partner',
        'listings.partner.enabled' => false,
        'listings.partner.base_url' => null,
        'listings.partner.token' => null,
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.rightmove.co.uk/properties/1');

    expect($result['success'])->toBeFalse()
        ->and($result['import_driver'])->toBe('partner')
        ->and($result['error'])->toContain('not configured');
});

it('chain driver falls back to url when partner is not configured', function (): void {
    config([
        'listings.import_driver' => 'chain',
        'listings.partner.enabled' => false,
        'listings.chain.try_partner_first' => true,
    ]);

    $jsonLd = json_encode([
        '@context' => 'https://schema.org',
        '@type' => 'Product',
        'name' => 'Chain fallback',
        'offers' => ['price' => 100000],
        'image' => ['https://example.com/x.jpg'],
    ]);

    Http::fake([
        'https://www.rightmove.co.uk/properties/chain-test' => Http::response(
            '<html><head><script type="application/ld+json">'.$jsonLd.'</script></head><body></body></html>',
            200,
        ),
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.rightmove.co.uk/properties/chain-test');

    expect($result['success'])->toBeTrue()
        ->and($result['import_driver'])->toBe('chain')
        ->and($result['title'])->toBe('Chain fallback');
});

it('chain driver falls back to url when partner returns HTTP error', function (): void {
    config([
        'listings.import_driver' => 'chain',
        'listings.partner.enabled' => true,
        'listings.partner.base_url' => 'https://api.partner.test/v1',
        'listings.partner.token' => 'secret-token',
        'listings.partner.import_path' => '/listings/import',
        'listings.chain.try_partner_first' => true,
    ]);

    $jsonLd = json_encode([
        '@context' => 'https://schema.org',
        '@type' => 'Product',
        'name' => 'After partner fail',
        'offers' => ['price' => 90000],
    ]);

    Http::fake([
        'https://api.partner.test/v1/listings/import' => Http::response('Server error', 500),
        'https://www.rightmove.co.uk/properties/chain-fail' => Http::response(
            '<html><head><script type="application/ld+json">'.$jsonLd.'</script></head><body></body></html>',
            200,
        ),
    ]);

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.rightmove.co.uk/properties/chain-fail');

    expect($result['success'])->toBeTrue()
        ->and($result['import_driver'])->toBe('chain')
        ->and($result['title'])->toBe('After partner fail');
});

it('uses api_key header when LISTINGS_PARTNER_AUTH_SCHEME is api_key', function (): void {
    config([
        'listings.import_driver' => 'partner',
        'listings.partner.enabled' => true,
        'listings.partner.base_url' => 'https://api.partner.test/v1',
        'listings.partner.token' => 'ak-secret',
        'listings.partner.import_path' => '/listings/import',
        'listings.partner.url_field' => 'url',
        'listings.partner.auth_scheme' => 'api_key',
        'listings.partner.api_key_header' => 'X-Partner-Key',
    ]);

    Http::fake(function ($request) {
        expect($request->url())->toBe('https://api.partner.test/v1/listings/import')
            ->and($request->hasHeader('X-Partner-Key', 'ak-secret'))->toBeTrue();

        return Http::response([
            'title' => 'Key auth',
            'price' => 125000,
        ], 200);
    });

    $service = app(ListingImportService::class);
    $result = $service->importFromUrl('https://www.zoopla.co.uk/for-sale/details/1');

    expect($result['success'])->toBeTrue()
        ->and($result['title'])->toBe('Key auth');
});
