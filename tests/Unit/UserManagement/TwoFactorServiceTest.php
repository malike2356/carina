<?php

declare(strict_types=1);

use App\Services\UserManagement\TwoFactorService;

it('generates a base32 secret key', function () {
    $secret = app(TwoFactorService::class)->generateSecret();

    expect($secret)->not->toBeEmpty()
        ->and(strlen($secret))->toBeGreaterThan(10);
});

it('creates recovery codes with hashed payload', function () {
    $pack = app(TwoFactorService::class)->generateRecoveryCodes(4);

    expect($pack['plain_codes'])->toHaveCount(4)
        ->and($pack['hashed_codes'])->toHaveCount(4);
});
