<?php

declare(strict_types=1);

use App\Models\Tenant\OnboardingJourney;
use App\Models\Tenant\User;
use App\Models\Tenant\UserInvestorProfile;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function investorJourneyTenantHost(): array
{
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Investor Journey '.uniqid(),
        'owner_name' => 'Owner Person',
        'owner_email' => 'owner-'.uniqid().'@investor-journey.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('renders the investor journey index page', function () {
    [, $host, $user] = investorJourneyTenantHost();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/investor-journey')
        ->assertOk()
        ->assertSee('Getting started');
});

it('advances through all five stages and completes the journey', function () {
    [$tenant, $host, $user] = investorJourneyTenantHost();

    $this->actingAs($user, 'web');

    $stages = [
        [1, ['experience_level' => 'beginner']],
        [2, ['available_capital' => 100000]],
        [3, ['weekly_hours_available' => 5, 'risk_appetite' => 'low']],
        [4, ['target_monthly_income' => 3000, 'target_years' => 5]],
        [5, ['location_preference' => 'local_only']],
    ];

    foreach ($stages as [$stage, $answers]) {
        $this->postJson('http://'.$host.'/investor-journey/stage', [
            'stage' => $stage,
            'answers' => $answers,
        ])->assertOk();
    }

    tenancy()->initialize($tenant);
    expect(UserInvestorProfile::query()->first()?->onboarding_complete)->toBeTrue();
    expect(UserInvestorProfile::query()->first()?->primary_strategy)->not->toBeNull();
    expect(OnboardingJourney::query()->first()?->complete)->toBeTrue();
    tenancy()->end();
});

it('generates a strategy recommendation after completion', function () {
    [$tenant, $host, $user] = investorJourneyTenantHost();

    $this->actingAs($user, 'web');

    $stages = [
        [1, ['experience_level' => 'beginner']],
        [2, ['available_capital' => 100000]],
        [3, ['weekly_hours_available' => 5, 'risk_appetite' => 'low']],
        [4, ['target_monthly_income' => 2000, 'target_years' => 5]],
        [5, ['location_preference' => 'local_only']],
    ];

    foreach ($stages as [$stage, $answers]) {
        $this->postJson('http://'.$host.'/investor-journey/stage', [
            'stage' => $stage,
            'answers' => $answers,
        ]);
    }

    tenancy()->initialize($tenant);
    $profile = UserInvestorProfile::query()->first();
    expect($profile?->primary_strategy)->toBeIn(['btl', 'hmo', 'brr', 'r2r', 'sa', 'flip', 'commercial']);
    expect($profile?->action_plan)->not->toBeEmpty();
    tenancy()->end();
});

it('renders the plan page after completion', function () {
    [, $host, $user] = investorJourneyTenantHost();

    $this->actingAs($user, 'web');

    $stages = [
        [1, ['experience_level' => 'beginner']],
        [2, ['available_capital' => 80000]],
        [3, ['weekly_hours_available' => 5, 'risk_appetite' => 'medium']],
        [4, ['target_monthly_income' => 3000, 'target_years' => 4]],
        [5, ['location_preference' => 'local_only']],
    ];

    foreach ($stages as [$stage, $answers]) {
        $this->postJson('http://'.$host.'/investor-journey/stage', [
            'stage' => $stage,
            'answers' => $answers,
        ]);
    }

    $this->get('http://'.$host.'/investor-journey/plan')
        ->assertOk()
        ->assertSee('My Investment Plan');
});

it('shows investor profile summary instead of redirecting to plan when already complete', function () {
    [, $host, $user] = investorJourneyTenantHost();

    $this->actingAs($user, 'web');

    foreach ([
        [1, ['experience_level' => 'beginner']],
        [2, ['available_capital' => 80000]],
        [3, ['weekly_hours_available' => 5, 'risk_appetite' => 'medium']],
        [4, ['target_monthly_income' => 3000, 'target_years' => 4]],
        [5, ['location_preference' => 'local_only']],
    ] as [$stage, $answers]) {
        $this->postJson('http://'.$host.'/investor-journey/stage', [
            'stage' => $stage,
            'answers' => $answers,
        ]);
    }

    $this->get('http://'.$host.'/investor-journey')
        ->assertOk()
        ->assertSee('Your saved profile')
        ->assertSee('Open Strategy Finder')
        ->assertDontSee('Step 1 of 5', false);
});
