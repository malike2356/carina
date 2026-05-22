<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\StrategyAssessment;
use App\Models\Tenant\User;
use App\Models\Tenant\UserInvestorProfile;
use App\Services\Carina\CarinaBaselineContextService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Carina SF Context '.uniqid(),
        'owner_name'   => 'Owner',
        'owner_email'  => 'owner-'.uniqid().'@carina-sf.test',
        'plan'         => 'starter',
    ]);
    tenancy()->initialize($tenant);
    $this->user   = User::query()->firstOrFail();
    $this->tenant = $tenant;
});

afterEach(function (): void {
    tenancy()->end();
});

it('appendixForUser includes strategy finder profile when assessment is saved', function (): void {
    UserInvestorProfile::query()->updateOrCreate(
        ['user_id' => $this->user->id],
        [
            'primary_strategy'     => 'btl',
            'secondary_strategy'   => 'hmo',
            'available_capital'    => 75000,
            'weekly_hours_available' => 10,
            'risk_appetite'        => 'medium',
            'strategy_reasoning'   => ['Strategy Finder matched btl to your capital, goals, available time, risk tolerance, and skills.'],
            'action_plan'          => [
                ['week' => 'Week 1-2: Foundation', 'actions' => ['Open a dedicated investment bank account.', 'Run the BTL calculator.']],
            ],
            'onboarding_complete'  => true,
            'onboarding_completed_at' => now(),
        ]
    );

    StrategyAssessment::query()->create([
        'user_id'          => $this->user->id,
        'answers'          => [
            'capital_bucket'  => '50_to_100k',
            'primary_goal'    => 'passive_income',
            'weekly_hours'    => '5_to_15',
            'risk_tolerance'  => 'medium',
            'pro_skills'      => 'tech',
        ],
        'top_strategy'     => 'btl',
        'strategy_scores'  => ['btl' => 82, 'hmo' => 74],
        'projections'      => [
            'btl' => [
                'typical_monthly_income'      => 280,
                'typical_months_to_first_income' => 4,
            ],
        ],
        'saved_to_profile' => true,
    ]);

    $appendix = app(CarinaBaselineContextService::class)->appendixForUser($this->user);

    expect($appendix)
        ->toContain('Strategy Finder profile')
        ->toContain('Buy-to-Let (BTL)')
        ->toContain('HMO')                         // runner-up
        ->toContain('£75,000')                     // capital
        ->toContain('10 hours/week')               // time
        ->toContain('medium')                      // risk
        ->toContain('build monthly passive income') // goal
        ->toContain('IT, tech & systems')           // skill
        ->toContain('£280')                        // projected income
        ->toContain('4 months')                    // months to income
        ->toContain('Week 1-2: Foundation')        // action plan
        ->toContain('Open a dedicated investment bank account'); // action plan action
});

it('appendixForUser returns empty string when no completed investor profile exists', function (): void {
    $appendix = app(CarinaBaselineContextService::class)->appendixForUser($this->user);

    expect($appendix)->not->toContain('Strategy Finder profile');
});

it('appendixForUser omits SF block when profile exists but onboarding not complete', function (): void {
    UserInvestorProfile::query()->create([
        'user_id'            => $this->user->id,
        'primary_strategy'   => 'btl',
        'onboarding_complete' => false,
    ]);

    $appendix = app(CarinaBaselineContextService::class)->appendixForUser($this->user);

    expect($appendix)->not->toContain('Strategy Finder profile');
});
