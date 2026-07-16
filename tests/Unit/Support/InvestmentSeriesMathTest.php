<?php

declare(strict_types=1);

use App\Support\InvestmentSeriesMath;

it('computes NPV for a simple series', function () {
    $flows = [-1000.0, 400.0, 400.0, 400.0];
    $npv = InvestmentSeriesMath::npv(0.10, $flows);
    expect($npv)->toBeLessThan(0.0)
        ->and($npv)->toBeGreaterThan(-50.0);
});

it('computes IRR when there is a sign change', function () {
    $flows = [-100.0, 40.0, 40.0, 40.0, 40.0];
    $irr = InvestmentSeriesMath::irrAnnualDecimal($flows);
    expect($irr)->not->toBeNull()
        ->and($irr)->toBeGreaterThan(0.0)
        ->and($irr)->toBeLessThan(0.5);
});

it('returns null for IRR without sign change', function () {
    expect(InvestmentSeriesMath::irrAnnualDecimal([100.0, 200.0]))->toBeNull();
});
