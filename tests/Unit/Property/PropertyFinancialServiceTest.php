<?php

declare(strict_types=1);

use App\Services\Property\PropertyFinancialService;

it('computes additional-property SDLT progressively', function () {
    $s = app(PropertyFinancialService::class);

    expect($s->stampDutyAdditionalProperty(300_000))->toBe(17500.0)
        ->and($s->stampDutyAdditionalProperty(250_000))->toBe(12500.0);
});

it('computes gross yield percent', function () {
    $s = app(PropertyFinancialService::class);

    expect($s->grossYieldPercent(1000, 300_000))->toBe(4.0);
});
