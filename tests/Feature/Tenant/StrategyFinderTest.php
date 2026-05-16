<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\StrategyAssessment;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Models\Tenant\UserInvestorProfile;
use App\Services\Deals\StrategyFinderService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Strategy Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sf.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->baseUrl = 'http://'.$host;
    $this->tenant = $tenant;
    $this->user = $user;
});

it('strategy finder index page returns 200', function (): void {
    $response = $this->get($this->baseUrl.'/strategy-finder');
    $response->assertOk();
});

it('run endpoint returns top_strategy and projections', function (): void {
    $response = $this->postJson($this->baseUrl.'/strategy-finder/run', [
        'capital_bucket' => '50_to_100k',
        'primary_goal' => 'passive_income',
        'weekly_hours' => '5_to_15',
        'risk_tolerance' => 'medium',
        'pro_skills' => 'none',
    ]);

    $response->assertOk()
        ->assertJsonStructure(['assessment_id', 'top_strategy', 'top_three', 'strategy_scores', 'projections']);

    expect($response->json('top_three'))->toBeArray()->toHaveCount(3);
});

it('run endpoint rejects missing field', function (): void {
    $response = $this->postJson($this->baseUrl.'/strategy-finder/run', [
        'capital_bucket' => '50_to_100k',
    ]);
    $response->assertStatus(422);
});

it('save endpoint saves top strategy to workspace settings', function (): void {
    $run = $this->postJson($this->baseUrl.'/strategy-finder/run', [
        'capital_bucket' => '100_to_250k',
        'primary_goal' => 'both',
        'weekly_hours' => '5_to_15',
        'risk_tolerance' => 'medium',
        'pro_skills' => 'trades',
    ]);

    $run->assertOk();
    $assessmentId = $run->json('assessment_id');

    $save = $this->postJson($this->baseUrl.'/strategy-finder/save', [
        'assessment_id' => $assessmentId,
    ]);

    $save->assertOk()->assertJsonPath('saved', true);

    tenancy()->initialize($this->tenant);
    expect(TenantSetting::query()->where('key', 'workspace_primary_strategy')->value('value'))
        ->toBe($run->json('top_strategy'));
    expect(StrategyAssessment::query()->find($assessmentId)?->saved_to_profile)->toBeTrue();
    $profile = UserInvestorProfile::query()->where('user_id', $this->user->id)->first();
    expect($profile?->onboarding_complete)->toBeTrue();
    expect($profile?->primary_strategy)->toBe($run->json('top_strategy'));
    expect($profile?->action_plan)->not->toBeEmpty();
    tenancy()->end();
});

it('plan page redirects when profile is incomplete', function (): void {
    $response = $this->get($this->baseUrl.'/investor-journey/plan');
    $response->assertRedirect($this->baseUrl.'/investor-journey');
});

it('plan page loads after strategy finder save', function (): void {
    $run = $this->postJson($this->baseUrl.'/strategy-finder/run', [
        'capital_bucket' => '50_to_100k',
        'primary_goal' => 'passive_income',
        'weekly_hours' => '5_to_15',
        'risk_tolerance' => 'medium',
        'pro_skills' => 'none',
    ]);
    $run->assertOk();

    $this->postJson($this->baseUrl.'/strategy-finder/save', [
        'assessment_id' => $run->json('assessment_id'),
    ])->assertOk();

    $this->get($this->baseUrl.'/investor-journey/plan')
        ->assertOk()
        ->assertSee('My Investment Plan');
});

it('StrategyFinderService scores r2r highest for zero capital profile', function (): void {
    $service = app(StrategyFinderService::class);
    $scores = $service->score([
        'capital_bucket' => 'under_25k',
        'primary_goal' => 'build_quickly',
        'weekly_hours' => '2_to_5',
        'risk_tolerance' => 'low',
        'pro_skills' => 'none',
    ]);

    arsort($scores);
    $top = array_key_first($scores);
    expect($top)->toBe('r2r');
});
