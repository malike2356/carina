<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

function complianceNavTestTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Nav '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-nav.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('allows an authenticated user to access the compliance dashboard', function (): void {
    [, $host, $user] = complianceNavTestTenant();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/compliance')
        ->assertOk();
});

it('allows an authenticated user to access the HMO licences index', function (): void {
    [, $host, $user] = complianceNavTestTenant();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/hmo-licences')
        ->assertOk();
});

it('allows an authenticated user to access the enforcement index', function (): void {
    [, $host, $user] = complianceNavTestTenant();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/compliance/enforcement')
        ->assertOk();
});

it('exposes non-negative integer compliance sidebar badge counts', function (): void {
    [, $host, $user] = complianceNavTestTenant();

    $response = $this->actingAs($user, 'web')
        ->get('http://'.$host.'/');

    $response->assertOk();

    $cached = session('compliance_nav_snapshot');
    expect($cached)->toBeArray()
        ->and($cached)->toHaveKey('badges');

    $badges = $cached['badges'];
    expect($badges)->toHaveKeys(['certificates_red', 'enforcement_attention', 'hmo_licences_attention'])
        ->and($badges['certificates_red'])->toBeInt()->toBeGreaterThanOrEqual(0)
        ->and($badges['enforcement_attention'])->toBeInt()->toBeGreaterThanOrEqual(0)
        ->and($badges['hmo_licences_attention'])->toBeInt()->toBeGreaterThanOrEqual(0);
});

it('shows property compliance status panel on property show when compliance is enabled', function (): void {
    [$tenant, $host, $user] = complianceNavTestTenant();

    tenancy()->initialize($tenant);
    $property = Property::query()->create([
        'address_line1' => '22 Nav Test Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'strategy' => 'btl',
        'status' => 'owned',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/properties/'.$property->id)
        ->assertOk()
        ->assertSee('Compliance status', false);
});
