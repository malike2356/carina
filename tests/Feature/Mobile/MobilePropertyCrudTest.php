<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates updates and archives properties via the mobile API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Props '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-props.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'multi_property')->update(['enabled' => true]);

    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $login = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_uuid' => '11111111-1111-1111-1111-111111111111',
    ]);
    $login->assertOk();
    $headers = ['Authorization' => 'Bearer '.$login->json('access_token')];

    $create = $this->postJson('http://'.$host.'/api/v1/mobile/properties', [
        'address_line1' => '1 Test Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'house',
        'status' => 'owned',
    ], $headers);
    $create->assertCreated()
        ->assertJsonPath('data.address_line1', '1 Test Street');

    $propertyId = (int) $create->json('data.id');

    $update = $this->putJson('http://'.$host.'/api/v1/mobile/properties/'.$propertyId, [
        'address_line1' => '1 Updated Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'house',
        'status' => 'owned',
    ], $headers);
    $update->assertOk()
        ->assertJsonPath('data.address_line1', '1 Updated Street');

    $docs = $this->getJson('http://'.$host.'/api/v1/mobile/properties/'.$propertyId.'/documents', $headers);
    $docs->assertOk()->assertJsonStructure(['data']);

    $tenancies = $this->getJson('http://'.$host.'/api/v1/mobile/properties/'.$propertyId.'/tenancies', $headers);
    $tenancies->assertOk()->assertJsonStructure(['data']);

    $delete = $this->deleteJson('http://'.$host.'/api/v1/mobile/properties/'.$propertyId, [], $headers);
    $delete->assertOk();

    tenancy()->initialize($tenant);
    expect(Property::query()->find($propertyId))->toBeNull();
    tenancy()->end();
});
