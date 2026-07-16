<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Services\Deals\CalculatorConfigService;
use App\Services\Deals\CalculatorIllustrativeBenchmarkService;
use App\Services\Deals\Calculators\DscrCalculator;

it('applies platform override to illustrative DSCR minimum', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'calculator_illustrative_dscr_min'],
        [
            'group' => 'calculators',
            'value' => '1.5',
            'type' => 'string',
            'is_encrypted' => false,
            'is_public' => false,
        ],
    );

    $cfg = app(CalculatorConfigService::class);
    expect((float) $cfg->get('illustrative_dscr_min'))->toBe(1.5);

    $calc = app(DscrCalculator::class);
    $result = $calc->calculate([
        'annual_noi' => 15000,
        'annual_debt_service' => 12000,
    ]);

    expect($result['outputs']['dscr_hurdle_used'])->toBe(1.5)
        ->and($result['outputs']['passes_1_25x'])->toBeFalse();

    $ui = app(CalculatorIllustrativeBenchmarkService::class)->build('dscr', $result['outputs']);
    expect($ui['checks'][0]['label'])->toContain('1.5');
});
