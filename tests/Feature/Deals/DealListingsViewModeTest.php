<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('renders sourced listings as a card grid by default and as a table when view is list', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'ViewMode Listings '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@viewmode.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Grid list toggle listing',
        'metrics' => [
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/123',
            'asking_price' => 250000,
        ],
        'status' => 'suggested',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/sourcing/listings')
        ->assertOk()
        ->assertSee('xl:grid-cols-3', false)
        ->assertDontSee('<table class="w-full text-sm">', false);

    $this->get('http://'.$host.'/deals/sourcing/listings?view=list')
        ->assertOk()
        ->assertSee('Grid list toggle listing', false)
        ->assertSee('<table class="w-full text-sm">', false);
});

it('keeps sale filter and view query when both are present on sourced listings', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'ViewMode Sale '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@viewsale.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Rent URL deal',
        'metrics' => [
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/to-rent/details/1',
            'asking_price' => 1200,
        ],
        'status' => 'suggested',
    ]);

    DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Sale URL deal',
        'metrics' => [
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/999',
            'asking_price' => 300000,
        ],
        'status' => 'suggested',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/sourcing/listings?listing_kind=sale&view=list')
        ->assertOk()
        ->assertSee('Sale URL deal', false)
        ->assertDontSee('Rent URL deal', false);
});

it('renders deal engine index as a table by default and as a card grid when view is grid', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'ViewMode Deals '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@viewdeals.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '7 Engine Row',
        'city' => 'Leeds',
        'postcode' => 'LS2 2AA',
        'property_type' => 'flat',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    DealAnalysis::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Engine index view mode',
        'metrics' => [],
        'status' => 'draft',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals')
        ->assertOk()
        ->assertSee('Engine index view mode', false)
        ->assertSee('<table class="w-full text-sm">', false)
        ->assertDontSee('xl:grid-cols-3', false);

    $this->get('http://'.$host.'/deals?view=grid')
        ->assertOk()
        ->assertSee('Engine index view mode', false)
        ->assertSee('xl:grid-cols-3', false);
});

it('preserves view when filtering deals', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'ViewMode Filter '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@viewfilter.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'hmo',
        'title' => 'Hidden BTL',
        'metrics' => [],
        'status' => 'draft',
    ]);

    DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Visible BTL',
        'metrics' => [],
        'status' => 'draft',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals?strategy=btl&view=grid')
        ->assertOk()
        ->assertSee('Visible BTL', false)
        ->assertDontSee('Hidden BTL', false)
        ->assertSee('xl:grid-cols-3', false);
});
