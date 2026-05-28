<?php

declare(strict_types=1);

use App\Services\Propcalc\PropcalcDealPackService;

it('renders a propcalc deal pack pdf from calculator snapshot', function () {
    $pdf = (new PropcalcDealPackService)->renderPdf([
        'strategy' => 'btl',
        'outputs' => [
            'monthly_cashflow' => 250,
            'annual_cashflow' => 3000,
            'gross_yield_pct' => 7.2,
            'deal_stacks' => true,
            'five_year_total_return' => 45000,
            'five_year_schedule' => [
                ['year' => 1, 'gross_rent_annual' => 18000, 'operating_costs_annual' => 5000, 'mortgage_annual' => 10200, 'void_cost_annual' => 1500, 'net_cashflow_annual' => 1300, 'property_value' => 255000, 'equity' => 67500],
            ],
        ],
        'assumptions' => ['Test assumption line.'],
    ]);

    expect($pdf)->not->toBe('')
        ->and(strlen($pdf))->toBeGreaterThan(1000);
});
