<?php

declare(strict_types=1);

use App\Models\Tenant\InvestmentGoal;
use App\Models\Tenant\StrategyAssessment;
use App\Models\Tenant\User;
use App\Models\Tenant\UserInvestorProfile;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: \App\Models\Central\Tenant, 1: string, 2: User}
 */
function investorProfileHubTenant(): array
{
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Profile Hub '.uniqid(),
        'owner_name' => 'Owner Person',
        'owner_email' => 'owner-'.uniqid().'@profile-hub.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('renders the profile hub for a user with no setup done', function (): void {
    [, $host, $user] = investorProfileHubTenant();

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/investor-profile');

    $response->assertOk();
    $response->assertSee('My Profile');
    $response->assertSee('Not started');
    $response->assertSee('Not run');
    $response->assertSee('Not set');
});

it('shows complete badges when all four sections are done', function (): void {
    [$tenant, $host, $user] = investorProfileHubTenant();

    tenancy()->initialize($tenant);

    UserInvestorProfile::query()->create([
        'user_id' => $user->id,
        'experience_level' => 'beginner',
        'available_capital' => 50000,
        'primary_strategy' => 'btl',
        'onboarding_complete' => true,
        'onboarding_completed_at' => now(),
    ]);

    StrategyAssessment::query()->create([
        'user_id' => $user->id,
        'answers' => ['primary_goal' => 'passive_income'],
        'top_strategy' => 'btl',
        'strategy_scores' => ['btl' => 100],
        'projections' => [],
        'saved_to_profile' => true,
    ]);

    InvestmentGoal::query()->create([
        'user_id' => $user->id,
        'title' => 'Replace salary',
        'strategy' => 'btl',
        'target_monthly_income' => 3000,
        'current_monthly_income' => 0,
        'starting_capital' => 50000,
        'timeline_years' => 5,
        'is_active' => true,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/investor-profile');

    $response->assertOk();
    $response->assertSee('Your profile is complete');
    $response->assertSee('Go to Deals');
});
