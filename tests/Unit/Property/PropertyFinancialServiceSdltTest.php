<?php

declare(strict_types=1);

use App\Services\Property\PropertyFinancialService;

it('computes standard residential SDLT on a mid-range purchase', function () {
    $svc = new PropertyFinancialService;
    expect($svc->stampDutyStandardResidential(300_000))->toBe(2500.0)
        ->and($svc->stampDutyFirstTimeBuyer(300_000))->toBe(0.0);
});

it('computes first-time buyer SDLT above the nil band', function () {
    $svc = new PropertyFinancialService;
    expect($svc->stampDutyFirstTimeBuyer(500_000))->toBe(3750.0);
});

it('routes profiles through stampDutyResidential', function () {
    $svc = new PropertyFinancialService;
    $std = $svc->stampDutyResidential(300_000, 'standard');
    $add = $svc->stampDutyResidential(300_000, 'additional_property');
    expect($std)->toBe(2500.0)
        ->and($add)->toBe(17_500.0);
});
