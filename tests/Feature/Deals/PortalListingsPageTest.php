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

it('shows live listings page for tenant user', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Listings Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@listings.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Test Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'lead',
        'source' => 'free_listing',
        'source_url' => 'https://www.rightmove.co.uk/properties/999',
        'created_by' => $user->id,
    ]);

    DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Rent listing',
        'metrics' => [
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/to-rent/details/888',
            'asking_price' => 1200,
        ],
        'status' => 'suggested',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/sourcing/listings')
        ->assertOk()
        ->assertSee('Import a listing URL', false)
        ->assertSee('Rent listing', false);

    $this->get('http://'.$host.'/deals/sourcing/listings?listing_kind=sale')
        ->assertOk()
        ->assertDontSee('Rent listing', false);

    $this->get('http://'.$host.'/deals/sourcing/listings?listing_kind=rent')
        ->assertOk()
        ->assertSee('Rent listing', false);

    $this->get('http://'.$host.'/deals/source/on-market-scanner')
        ->assertOk()
        ->assertSee('Portal capture', false);
});
