<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\BmvNoMoneyDownCalculator;

it('correctly identifies a no-money-down deal at 36% discount', function () {
    $result = app(BmvNoMoneyDownCalculator::class)->calculate([
        'market_value' => 300_000,
        'purchase_price' => 190_000,
        'remortgage_ltv' => 75,
        'bridging_arrangement_fee_pct' => 2.0,
        'legal_fees' => 2500,
        'valuation_fee' => 500,
        'is_additional_property' => true,
    ]);

    $outputs = $result['outputs'];

    expect($outputs['is_no_money_down'])->toBeTrue()
        ->and($outputs['discount_pct'])->toBeGreaterThan(30.0)
        ->and($outputs['verdict'])->toBeIn(['no_money_down', 'cash_out']);
});

it('flags a 15% discount deal as not no-money-down', function () {
    $result = app(BmvNoMoneyDownCalculator::class)->calculate([
        'market_value' => 300_000,
        'purchase_price' => 255_000,
        'remortgage_ltv' => 75,
        'bridging_arrangement_fee_pct' => 2.0,
        'legal_fees' => 2500,
        'valuation_fee' => 500,
        'is_additional_property' => true,
    ]);

    $outputs = $result['outputs'];

    expect($outputs['is_no_money_down'])->toBeFalse()
        ->and($outputs['verdict'])->toBeIn(['reduced_money_in', 'standard_btl']);
});

it('breakeven discount is approximately 32% at standard assumptions', function () {
    $result = app(BmvNoMoneyDownCalculator::class)->calculate([
        'market_value' => 200_000,
        'purchase_price' => (int) (200_000 * 0.68),
        'remortgage_ltv' => 75,
        'bridging_arrangement_fee_pct' => 2.0,
        'legal_fees' => 2500,
        'valuation_fee' => 500,
        'is_additional_property' => true,
    ]);

    expect($result['outputs']['breakeven_discount_pct'])->toBeLessThanOrEqual(32.5);
});

it('net cash position equals remortgage minus purchase minus all costs', function () {
    $mv = 300_000;
    $pp = 190_000;
    $ltv = 0.75;
    $bf = $pp * 0.02;
    $rm = $mv * $ltv;

    $result = app(BmvNoMoneyDownCalculator::class)->calculate([
        'market_value' => $mv,
        'purchase_price' => $pp,
        'remortgage_ltv' => 75,
        'bridging_arrangement_fee_pct' => 2.0,
        'legal_fees' => 2500,
        'valuation_fee' => 500,
        'is_additional_property' => true,
    ]);

    $outputs = $result['outputs'];
    $sdlt = $outputs['sdlt'];
    $expectedProceeds = $rm - $pp - $bf;

    expect(abs($outputs['proceeds_after_bridging'] - (int) round($expectedProceeds)))->toBeLessThan(10)
        ->and($outputs['net_cash_position'])->toBe((int) round($expectedProceeds - 2500 - 500 - $sdlt));
});
