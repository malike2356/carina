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
        ->and($result['skill_insight']['skill_key'])->toBe('tech')
        ->and($result['skill_insight']['headline'])->toContain('IT and tech')
        ->and($result['skill_insight']['body'])->toContain('infrastructure')
        ->and($result['skill_insight']['body'])->not->toContain('Twenty years')
        ->and($result['skill_insight']['examples'])->toHaveCount(5)
        ->and($result['skill_insight']['why_match'])->toContain('IT and tech background');
});

it('returns finance skill insight when pro_skills is finance', function (): void {
    $service = app(StrategyFinderService::class);
    $result = $service->run([
        'capital_bucket' => '100_to_250k',
        'primary_goal' => 'both',
        'weekly_hours' => '5_to_15',
        'risk_tolerance' => 'medium',
        'pro_skills' => 'finance',
    ]);

    expect($result['skill_insight'])->toBeArray()
        ->and($result['skill_insight']['skill_key'])->toBe('finance')
        ->and($result['skill_insight']['why_match'])->toContain('finance background');
});

it('returns no skill insight when pro_skills is none', function (): void {
    $service = app(StrategyFinderService::class);
    $result = $service->run([
        'capital_bucket' => 'under_25k',
        'primary_goal' => 'build_quickly',
        'weekly_hours' => '2_to_5',
        'risk_tolerance' => 'low',
        'pro_skills' => 'none',
    ]);

    expect($result['skill_insight'])->toBeNull();
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
