<?php

declare(strict_types=1);

use App\Services\Deals\Drivers\RightmoveListingImportDriver;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    Http::preventStrayRequests();
});

it('merges gallery urls from rightmove html with json-ld', function (): void {
    $jsonLd = json_encode([
        '@context' => 'https://schema.org',
        '@type' => 'Product',
        'name' => 'RM title',
        'offers' => ['price' => 200000],
        'image' => ['https://media.rightmove.co.uk/dir/a.jpg'],
        'address' => [
            'streetAddress' => '1 Test Street',
            'addressLocality' => 'Portsmouth',
            'postalCode' => 'PO1 1AB',
        ],
        'numberOfRooms' => 2,
    ]);

    $extraImg = 'https://media.rightmove.co.uk/dir/b.jpg';
    $html = '<html><head><script type="application/ld+json">'.$jsonLd.'</script></head><body>'
        .'<img src="'.$extraImg.'" alt=""></body></html>';

    Http::fake([
        'https://www.rightmove.co.uk/properties/999' => Http::response($html, 200),
    ]);

    $driver = app(RightmoveListingImportDriver::class);
    $out = $driver->importFromUrl('https://www.rightmove.co.uk/properties/999');

    expect($out['success'])->toBeTrue()
        ->and($out['platform'])->toBe('rightmove')
        ->and($out['title'])->toBe('RM title')
        ->and($out['images'])->toContain('https://media.rightmove.co.uk/dir/a.jpg')
        ->and($out['images'])->toContain($extraImg);
});
