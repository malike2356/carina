<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAlert;
use App\Models\Tenant\Property;
use App\Models\Tenant\SourcingCriterion;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('shows deal workspace and sourcing criteria pages for the tenant user', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Workspace Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@workspace.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/workspace')
        ->assertOk()
        ->assertSee('Deals hub', false)
        ->assertSee('Deal shortlists', false)
        ->assertSee('Area profiles', false);

    $this->get('http://'.$host.'/deals/sourcing/criteria')
        ->assertOk()
        ->assertSee('Sourcing criteria', false);

    $this->get('http://'.$host.'/deals/sourcing/inbox')
        ->assertOk()
        ->assertSee('Match inbox', false);
});

it('lists sourcing matcher alerts on the inbox with open as deal', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Inbox Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@inbox.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $property = Property::query()->create([
        'address_line1' => '9 Inbox Lane',
        'city' => 'Birmingham',
        'postcode' => 'B1 1AA',
        'property_type' => 'semi-detached',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);
    DealAlert::query()->create([
        'deal_analysis_id' => null,
        'created_by' => $user->id,
        'name' => 'Sourcing match: Birmingham BTL',
        'criteria' => [
            'source' => 'sourcing_matcher',
            'hit' => true,
            'property_id' => $property->id,
            'score' => 1.25,
        ],
        'frequency' => 'daily',
        'is_active' => false,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/sourcing/inbox')
        ->assertOk()
        ->assertSee('Sourcing match: Birmingham BTL', false)
        ->assertSee('Open as deal', false)
        ->assertSee('9 Inbox Lane', false);
});

it('creates updates and deletes a sourcing criterion', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Criteria Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@criteria.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/deals/sourcing/criteria', [
        'name' => 'Birmingham BTL',
        'strategy' => 'btl',
        'min_price' => 100000,
        'max_price' => 250000,
        'min_bedrooms' => 2,
        'max_bedrooms' => 4,
        'min_yield_pct' => 5.5,
        'postcodes_raw' => "B1 1AA\nM1 1AE",
        'property_types_raw' => 'semi-detached, terrace',
        'is_active' => '1',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $row = SourcingCriterion::query()->where('created_by', $user->id)->firstOrFail();
    expect($row->name)->toBe('Birmingham BTL')
        ->and($row->postcodes)->toBe(['B11AA', 'M11AE'])
        ->and($row->property_types)->toBe(['semi-detached', 'terrace']);
    tenancy()->end();

    $this->put('http://'.$host.'/deals/sourcing/criteria/'.$row->id, [
        'name' => 'Birmingham BTL v2',
        'strategy' => 'btl',
        'min_price' => 120000,
        'max_price' => 240000,
        'postcodes_raw' => '',
        'property_types_raw' => '',
        'is_active' => '0',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $row->refresh();
    expect($row->name)->toBe('Birmingham BTL v2')
        ->and($row->is_active)->toBeFalse()
        ->and($row->postcodes)->toBeNull();
    tenancy()->end();

    $this->delete('http://'.$host.'/deals/sourcing/criteria/'.$row->id)
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(SourcingCriterion::query()->whereKey($row->id)->exists())->toBeFalse();
    tenancy()->end();
});

it('returns 403 when editing another users sourcing criterion', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Criteria Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@criteria2.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $owner = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $other = User::factory()->create();
    $criterion = SourcingCriterion::query()->create([
        'tenant_id' => null,
        'created_by' => $other->id,
        'name' => 'Other user rule',
        'strategy' => 'hmo',
        'is_active' => true,
    ]);
    tenancy()->end();

    $this->actingAs($owner, 'web');

    $this->get('http://'.$host.'/deals/sourcing/criteria/'.$criterion->id.'/edit')
        ->assertForbidden();
});
