<?php

declare(strict_types=1);

use App\Models\Tenant\DealAnalysis;
use App\Services\Carina\DealPropertyDataCarinaContext;

it('returns empty appendix when no snapshot', function (): void {
    $deal = new DealAnalysis;
    $deal->propertydata_market_snapshot = null;

    expect(app(DealPropertyDataCarinaContext::class)->promptAppendix($deal))->toBe('');
});

it('summarises successful sections from snapshot', function (): void {
    $deal = new DealAnalysis;
    $deal->propertydata_market_snapshot = [
        'postcode' => 'LS11AA',
        'sections' => [
            'demographics' => ['status' => 'success', 'data' => ['population' => 1000]],
            'failed_bit' => ['status' => 'error', 'message' => 'nope'],
        ],
    ];
    $deal->propertydata_market_snapshot_at = now();

    $out = app(DealPropertyDataCarinaContext::class)->promptAppendix($deal);

    expect($out)->toContain('PropertyData')
        ->toContain('demographics')
        ->toContain('population')
        ->not->toContain('failed_bit');
});
