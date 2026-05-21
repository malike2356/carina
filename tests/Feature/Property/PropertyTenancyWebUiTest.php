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

it('creates a tenancy from the property show page and lists it on the workspace directory', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ten UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ten-ui.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '22 Renter Road',
        'city' => 'Bristol',
        'postcode' => 'BS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/properties/'.$property->id.'/tenancies', [
        'tenant_name' => 'Alex Tenant',
        'rent_amount' => '950.50',
        'start_date' => '2025-06-01',
        'deposit' => '1000',
    ])->assertRedirect($base.'/properties/'.$property->id);

    $tenancyId = PropertyTenancy::query()->where('property_id', $property->id)->value('id');

    $this->get($base.'/properties/'.$property->id)
        ->assertOk()
        ->assertSee('Lettings')
        ->assertSee('tenancies')
        ->assertSee('Alex Tenant')
        ->assertSee($base.'/properties/tenancies/'.$tenancyId, false)
        ->assertSee('Dossier');

    $this->get($base.'/properties/tenancies')
        ->assertOk()
        ->assertSee('Alex Tenant')
        ->assertSee('22 Renter Road');
});

it('updates and ends a tenancy from the property show page', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ten End '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ten-end.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => 'End Lane',
        'city' => 'Cardiff',
        'postcode' => 'CF10 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Before Name',
        'rent_amount' => 800,
        'start_date' => '2025-01-01',
        'end_date' => null,
        'deposit' => null,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;
    $pid = $property->id;
    $tid = $tenancy->id;

    $this->from($base.'/properties/'.$pid)
        ->put($base.'/properties/'.$pid.'/tenancies/'.$tid, [
            'tenant_name' => 'After Name',
            'rent_amount' => '825',
            'start_date' => '2025-01-01',
            'end_date' => '',
            'deposit' => '',
        ])->assertRedirect($base.'/properties/'.$pid);

    $tenancy->refresh();
    expect($tenancy->tenant_name)->toBe('After Name')
        ->and((float) $tenancy->rent_amount)->toBe(825.0);

    $this->from($base.'/properties/'.$pid)
        ->post($base.'/properties/'.$pid.'/tenancies/'.$tid.'/end', [
            'end_date' => '2026-01-15',
        ])->assertRedirect($base.'/properties/'.$pid);

    $tenancy->refresh();
    expect($tenancy->end_date?->toDateString())->toBe('2026-01-15');

    $this->get($base.'/properties/'.$pid)
        ->assertOk()
        ->assertSee('After Name')
        ->assertSee('ended 15 Jan 2026');
});

it('hard deletes a tenancy and rejects delete when tenancy does not belong to the property', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ten Del '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ten-del.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $propertyA = Property::query()->create([
        'address_line1' => 'A Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $propertyB = Property::query()->create([
        'address_line1' => 'B Road',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $propertyA->id,
        'tenant_name' => 'Delete Me',
        'rent_amount' => 700,
        'start_date' => '2025-03-01',
        'end_date' => null,
        'deposit' => null,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;
    $tid = $tenancy->id;

    $this->delete($base.'/properties/'.$propertyB->id.'/tenancies/'.$tid)
        ->assertNotFound();

    expect(PropertyTenancy::query()->whereKey($tid)->exists())->toBeTrue();

    $this->from($base.'/properties/'.$propertyA->id)
        ->delete($base.'/properties/'.$propertyA->id.'/tenancies/'.$tid)
        ->assertRedirect($base.'/properties/'.$propertyA->id)
        ->assertSessionHas('success', 'Tenancy removed.');

    expect(PropertyTenancy::query()->whereKey($tid)->exists())->toBeFalse();

    $this->get($base.'/properties/'.$propertyA->id)
        ->assertOk()
        ->assertDontSee('Delete Me');

    $this->get($base.'/properties/tenancies')
        ->assertOk()
        ->assertDontSee('Delete Me');
});

it('deletes a tenancy from the workspace directory', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ten Dir Del '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ten-dir-del.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => 'Dir Delete Street',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Listed Then Gone',
        'rent_amount' => 600,
        'start_date' => '2025-04-01',
        'end_date' => null,
        'deposit' => null,
    ]);
    $tid = $tenancy->id;
    $pid = $property->id;

    tenancy()->end();

    $base = 'http://'.$host;
    $this->actingAs($user, 'web');

    $this->get($base.'/properties/tenancies')
        ->assertOk()
        ->assertSee('Listed Then Gone')
        ->assertSee('Delete');

    $this->from($base.'/properties/tenancies')
        ->delete($base.'/properties/'.$pid.'/tenancies/'.$tid, [
            'redirect_to' => 'tenancies_index',
        ])
        ->assertRedirect($base.'/properties/tenancies')
        ->assertSessionHas('success', 'Tenancy removed.');

    expect(PropertyTenancy::query()->whereKey($tid)->exists())->toBeFalse();

    $this->get($base.'/properties/tenancies')
        ->assertOk()
        ->assertDontSee('Listed Then Gone');
});

it('redirects guests away from tenancy delete without removing the row', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ten Guest '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ten-guest.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => 'Guest Row',
        'city' => 'Oxford',
        'postcode' => 'OX1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Guest Guard',
        'rent_amount' => 500,
        'start_date' => '2025-05-01',
        'end_date' => null,
        'deposit' => null,
    ]);
    $tid = $tenancy->id;
    $pid = $property->id;

    tenancy()->end();

    $response = $this->delete('http://'.$host.'/properties/'.$pid.'/tenancies/'.$tid);

    $response->assertRedirect();
    expect($response->headers->get('Location'))->toContain('login');

    tenancy()->initialize($tenant);
    expect(PropertyTenancy::query()->whereKey($tid)->exists())->toBeTrue();
});
