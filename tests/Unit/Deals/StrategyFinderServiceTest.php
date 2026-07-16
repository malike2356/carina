<?php

declare(strict_types=1);

use App\Services\Deals\StrategyFinderService;

it('scores r2r highest for low capital quick-build profile', function (): void {
    $service = app(StrategyFinderService::class);
    $scores = $service->score([
        'capital_bucket' => 'under_5k',
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
        'capital_bucket' => 'under_5k',
        'primary_goal' => 'build_quickly',
        'weekly_hours' => '2_to_5',
        'risk_tolerance' => 'low',
        'pro_skills' => 'none',
    ]);

    expect($result['skill_insight'])->toBeNull();
});

it('detects capital gap for under_5k when cheapest strategy is still out of reach', function (): void {
    $service = app(StrategyFinderService::class);
    $result = $service->run([
        'capital_bucket' => 'under_5k',    // midpoint £2,500
        'primary_goal'   => 'build_quickly',
        'weekly_hours'   => '2_to_5',
        'risk_tolerance' => 'low',
        'pro_skills'     => 'none',
    ]);

    // R2R scores highest (99 pts) but needs £3k - £500 above the £2,500 midpoint.
    // No other strategy has a projection for under_5k, so bridge_strategy is null.
    $f = $result['feasibility'];
    expect($result['top_strategy'])->toBe('r2r')
        ->and($f['can_start_top_today'])->toBeFalse()
        ->and($f['capital_gap'])->toBe(500)
        ->and($f['bridge_strategy'])->toBeNull()
        ->and($f['months_to_top'])->toBe(1)  // 500 / 500 = 1 month
        ->and($f['monthly_savings_assumption'])->toBe(500);
});

it('detects capital gap and finds an affordable bridge strategy', function (): void {
    $service = app(StrategyFinderService::class);
    $result = $service->run([
        'capital_bucket' => '50_to_100k',   // midpoint £75,000
        'primary_goal'   => 'capital_growth',
        'weekly_hours'   => 'over_15',
        'risk_tolerance' => 'medium',
        'pro_skills'     => 'trades',
    ]);

    // BRR scores highest (95 pts) but needs £90k - £15k above the £75k midpoint.
    // HMO is next in score order at £55k which is affordable today.
    $f = $result['feasibility'];
    expect($result['top_strategy'])->toBe('brr')
        ->and($f['can_start_top_today'])->toBeFalse()
        ->and($f['capital_gap'])->toBe(15000)
        ->and($f['bridge_strategy'])->toBe('hmo')
        ->and($f['bridge_entry_cost'])->toBe(55000)
        ->and($f['bridge_gap'])->toBe(0)
        ->and($f['months_to_bridge'])->toBeNull()
        ->and($f['months_to_top'])->toBe(30); // 15000 / 500 = 30 months
});

it('reports no capital gap when strategy is affordable at bracket midpoint', function (): void {
    $service = app(StrategyFinderService::class);
    $result = $service->run([
        'capital_bucket' => '5k_to_25k',
        'primary_goal'   => 'passive_income',
        'weekly_hours'   => '2_to_5',
        'risk_tolerance' => 'low',
        'pro_skills'     => 'none',
    ]);

    $f = $result['feasibility'];
    // R2R is top at this level (needs £3k; midpoint is £15k) - no gap.
    expect($f['can_start_top_today'])->toBeTrue()
        ->and($f['capital_gap'])->toBe(0);
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
