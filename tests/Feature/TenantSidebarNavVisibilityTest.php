<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: string, 2: User}
 */
function tenantHostUserWithOnboardingComplete(): array
{
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Sidebar Nav '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sidebar-nav.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode([
            'completed_at' => now()->toIso8601String(),
            'onboarding_version' => 2,
            'max_unlocked_step' => WorkspaceOnboardingService::TOTAL_STEPS,
            'workspace' => ['display_name' => 'Sidebar Nav Co'],
            'strategy' => ['primary' => 'btl', 'target_postcodes_raw' => ''],
            'profile' => ['name' => 'Owner', 'phone' => null],
            'preferences' => ['timezone' => 'Europe/London'],
            'preferences_skipped' => false,
        ]), 'group' => 'onboarding']
    );
    $user = User::query()->firstOrFail();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('hides Deal Engine in the tenant sidebar when the deal_engine feature flag is off', function (): void {
    [, $host, $user] = tenantHostUserWithOnboardingComplete();

    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => false]);

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/');

    $response->assertOk();
    $response->assertDontSee('Deal Engine', false);
    $response->assertDontSee('Active Deals', false);
});

it('shows Deal Engine in the tenant sidebar when the deal_engine feature flag is on', function (): void {
    [, $host, $user] = tenantHostUserWithOnboardingComplete();

    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/');

    $response->assertOk();
    $response->assertSee('Deal Engine', false);
    $response->assertSee('Active Deals', false);
});

it('links Academy in the overview to the LMS course catalog instead of external SSO', function (): void {
    [, $host, $user] = tenantHostUserWithOnboardingComplete();

    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true, 'tenant_overrides' => null]);

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/');

    $response->assertOk();
    $response->assertSee('href="http://'.$host.'/lms"', false);
    $response->assertDontSee('data-academy-sso-trigger', false);
});
