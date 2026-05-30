<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: string, 2: User}
 */
function miHubTenantHostUser(): array
{
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'MI Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'mi-hub-'.uniqid().'@example.test',
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
            'workspace' => ['display_name' => 'MI Hub Co'],
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

it('loads the market intelligence hub index when deal engine is enabled', function (): void {
    [, $host, $user] = miHubTenantHostUser();

    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/market-intelligence')
        ->assertOk()
        ->assertSee('Market intelligence', false);
});

it('redirects unknown market intelligence tools to the hub with a message', function (): void {
    [, $host, $user] = miHubTenantHostUser();

    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/market-intelligence/not-a-real-tool');

    $response->assertStatus(302);
    expect($response->headers->get('Location'))->toContain('/market-intelligence');
    $response->assertSessionHas('warning');
});

it('redirects postcode market intelligence tools to due diligence', function (): void {
    [, $host, $user] = miHubTenantHostUser();

    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/market-intelligence/live-map?postcode=SW1A1AA');

    $response->assertRedirect();
    expect($response->headers->get('Location'))->toContain('/due-diligence');
    expect($response->headers->get('Location'))->toContain('tab=identity');
    expect($response->headers->get('Location'))->toContain('postcode=SW1A1AA');
});

it('returns tool_sections when data endpoint is called with a tool', function (): void {
    [, $host, $user] = miHubTenantHostUser();

    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    Http::fake([
        'https://api.postcodes.io/postcodes/*' => Http::response([
            'status' => 200,
            'result' => [
                'postcode' => 'SW1A 1AA',
                'latitude' => 51.501,
                'longitude' => -0.142,
            ],
        ], 200),
        'https://api.propertydata.co.uk/*' => Http::response([
            'status' => 'success',
            'data' => [],
        ], 200),
    ]);

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/market-intelligence/data?postcode=SW1A1AA&bedrooms=3&property_type=flat&tool=live-map');

    $response->assertOk();
    $response->assertJsonStructure(['postcode', 'tool', 'tool_sections', 'postcode_geo', 'propertydata', 'workspace_listings']);
    $response->assertJsonPath('tool', 'live-map');
    expect($response->json('tool_sections'))->toBeArray();
});
