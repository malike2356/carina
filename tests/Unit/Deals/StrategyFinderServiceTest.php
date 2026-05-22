<?php

declare(strict_types=1);

use App\Services\Deals\StrategyFinderService;

it('scores r2r highest for low capital quick-build profile', function (): void {
    $service = app(StrategyFinderService::class);
    $scores = $service->score([
        'capital_bucket' => 'under_25k',
        'primary_goal' => 'build_quickly',
        'weekly_hours' => '2_to_5',
        'risk_tolerance' => 'low',
        'pro_skills' => 'none',
    ]);

    arsort($scores);
    expect(array_key_first($scores))->toBe('r2r');
});

it('scores sa highly for tech skills with passive income goal', function (): void {
    $service = app(StrategyFinderService::class);
    $result = $service->run([
        'capital_bucket' => '50_to_100k',
        'primary_goal' => 'passive_income',
        'weekly_hours' => '5_to_15',
        'risk_tolerance' => 'medium',
        'pro_skills' => 'tech',
    ]);

    expect($result['top_strategy'])->toBe('sa')
        ->and($result['top_three'])->toContain('btl')
        ->and($result['skill_insight'])->toBeArray()
        ->and($result['skill_insight']['headline'])->toContain('IT');
});

it('run returns three strategies with projections keyed by slug', function (): void {
    $service = app(StrategyFinderService::class);
    $result = $service->run([
        'capital_bucket' => '50_to_100k',
        'primary_goal' => 'passive_income',
        'weekly_hours' => '5_to_15',
        'risk_tolerance' => 'medium',
        'pro_skills' => 'none',
    ]);

    expect($result['top_three'])->toHaveCount(3);
    expect($result['projections'])->toHaveKeys($result['top_three']);
});
