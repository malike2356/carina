<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('shows the tenancies directory for an authenticated tenant user', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ten Dir '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ten-dir.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '9 Lettings Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Jane Renter',
        'rent_amount' => 1250.00,
        'start_date' => now()->subMonth()->toDateString(),
        'end_date' => null,
        'deposit' => 1500.00,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/properties/tenancies')
        ->assertOk()
        ->assertSee('Tenancies')
        ->assertSee('Actions')
        ->assertSee('Delete')
        ->assertSee('Jane Renter')
        ->assertSee('9 Lettings Lane');
});
