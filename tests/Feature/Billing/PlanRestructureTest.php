<?php

declare(strict_types=1);

use App\Models\Central\SubscriptionPlan;
use Database\Seeders\Central\SubscriptionPlanSeeder;

it('seeds investor, operator, and studio plans from config', function (): void {
    $this->seed(SubscriptionPlanSeeder::class);

    $slugs = SubscriptionPlan::query()->where('is_active', true)->pluck('slug')->sort()->values()->toArray();

    expect($slugs)->toBe(['founder', 'investor', 'operator', 'studio']);
});

it('renames mentor_network to studio when no studio row exists', function (): void {
    SubscriptionPlan::query()->forceCreate([
        'slug' => 'mentor_network',
        'name' => 'Mentor Network',
        'price' => '299.00',
        'currency' => 'GBP',
        'interval' => 'month',
        'features' => ['modules' => []],
        'is_active' => true,
        'sort_order' => 20,
    ]);

    $this->seed(SubscriptionPlanSeeder::class);

    expect(SubscriptionPlan::query()->where('slug', 'mentor_network')->exists())->toBeFalse();
    expect(SubscriptionPlan::query()->where('slug', 'studio')->exists())->toBeTrue();
    expect(SubscriptionPlan::query()->where('slug', 'academy')->exists())->toBeFalse();
});

it('investor plan has correct limits and module set', function (): void {
    $this->seed(SubscriptionPlanSeeder::class);

    $plan = SubscriptionPlan::query()->where('slug', 'investor')->firstOrFail();

    expect($plan->price)->toBe('49.00');
    expect($plan->features['limits']['properties'])->toBe(25);
    expect($plan->features['limits']['team_seats'])->toBe(3);
    expect($plan->features['modules'])->toContain('deal_engine');
    expect($plan->features['modules'])->not->toContain('mentoring_os');
});

it('studio plan has unlimited seats and properties', function (): void {
    $this->seed(SubscriptionPlanSeeder::class);

    $plan = SubscriptionPlan::query()->where('slug', 'studio')->firstOrFail();

    expect($plan->price)->toBe('199.00');
    expect($plan->features['limits']['properties'])->toBeNull();
    expect($plan->features['limits']['team_seats'])->toBeNull();
    expect($plan->features['modules'])->toContain('mentoring_os');
    expect($plan->features['modules'])->toContain('community_learning');
});
