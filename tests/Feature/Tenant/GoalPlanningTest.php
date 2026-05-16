<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\InvestmentGoal;
use App\Models\Tenant\User;
use App\Services\Goals\GoalPlanningService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Goal Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@goal.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->tenant = $tenant;
    $this->actingAs($user, 'web');
    $this->baseUrl = 'http://'.$host;
});

it('goals index returns 200', function () {
    $response = $this->get($this->baseUrl.'/goals');
    $response->assertOk();
});

it('creating a goal generates milestones', function () {
    $response = $this->post($this->baseUrl.'/goals', [
        'title' => 'Test: £3k/mo in 3 years',
        'strategy' => 'btl',
        'target_monthly_income' => 3000,
        'current_monthly_income' => 0,
        'starting_capital' => 50000,
        'timeline_years' => 3,
    ]);

    $response->assertRedirect();

    tenancy()->initialize($this->tenant);
    $goal = InvestmentGoal::query()->where('strategy', 'btl')->firstOrFail();
    expect($goal->milestones()->count())->toBe(12);
    tenancy()->end();
});

it('GoalPlanningService calculates correct deal count for BTL', function () {
    $service = app(GoalPlanningService::class);
    $result = $service->calculate([
        'strategy' => 'btl',
        'target_monthly_income' => 1000,
        'current_monthly_income' => 0,
        'starting_capital' => 100000,
        'timeline_years' => 5,
    ]);

    expect($result['deals_needed'])->toBe(5);
    expect($result['income_gap'])->toBe(1000.0);
});

it('completing a milestone updates progress', function () {
    $this->post($this->baseUrl.'/goals', [
        'title' => 'Milestone test',
        'strategy' => 'r2r',
        'target_monthly_income' => 500,
        'starting_capital' => 5000,
        'timeline_years' => 1,
    ]);

    tenancy()->initialize($this->tenant);
    $goal = InvestmentGoal::query()->firstOrFail();
    $milestone = $goal->milestones()->first();
    tenancy()->end();

    $response = $this->postJson(
        $this->baseUrl.'/goals/milestones/'.$milestone->id.'/complete',
        ['completed' => true]
    );

    $response->assertOk()->assertJsonPath('completed', true);
    expect($response->json('progress'))->toBeGreaterThan(0.0);
});
