<?php

declare(strict_types=1);

use App\Services\Property\PostcodeService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Cache::flush();
});

it('normalizes UK postcodes', function () {
    $s = app(PostcodeService::class);

    expect($s->normalize('sw1a1aa'))->toBe('SW1A 1AA')
        ->and($s->normalize(' EC1A 1BB '))->toBe('EC1A 1BB');
});

it('validates UK postcode format', function () {
    $s = app(PostcodeService::class);

    expect($s->isValidUkPostcode('SW1A 1AA'))->toBeTrue()
        ->and($s->isValidUkPostcode('INVALID'))->toBeFalse();
});

it('looks up a postcode via postcodes.io', function () {
    Http::fake([
        'https://api.postcodes.io/postcodes/SW1A%201AA' => Http::response([
            'status' => 200,
            'result' => [
                'postcode' => 'SW1A 1AA',
                'latitude' => 51.501,
                'longitude' => -0.142,
                'admin_district' => 'Westminster',
            ],
        ], 200),
    ]);

    $out = app(PostcodeService::class)->lookup('SW1A1AA');

    expect($out['valid'])->toBeTrue()
        ->and($out['admin_district'])->toBe('Westminster');
});
