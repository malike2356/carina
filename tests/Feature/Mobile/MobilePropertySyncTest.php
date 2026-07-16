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

it('syncs property create via mobile sync endpoint', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile property sync '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-property-sync.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $deviceUuid = '55555555-5555-5555-5555-555555555555';

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
        'device_uuid' => $deviceUuid,
    ]);
    $login->assertOk();
    $access = (string) $login->json('access_token');

    $sync = $this->postJson('http://'.$host.'/api/v1/mobile/sync', [
        'actions' => [
            [
                'action' => 'property.create',
                'payload' => [
                    'data' => [
                        'address_line1' => '1 Sync Street',
                        'city' => 'Leeds',
                        'postcode' => 'LS1 1AA',
                        'property_type' => 'house',
                        'status' => 'owned',
                    ],
                ],
            ],
        ],
    ], [
        'Authorization' => 'Bearer '.$access,
        'X-Device-UUID' => $deviceUuid,
    ]);

    $sync->assertOk()->assertJsonPath('applied', 1)->assertJsonPath('errors', []);

    tenancy()->initialize($tenant);
    expect(Property::query()->where('address_line1', '1 Sync Street')->exists())->toBeTrue();
    tenancy()->end();
});

it('lists workspace users for tenant admin on mobile admin endpoint', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile admin '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-admin.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $deviceUuid = '66666666-6666-6666-6666-666666666666';

    tenancy()->initialize($tenant);
    User::query()->where('email', $tenant->owner_email)->firstOrFail()
        ->forceFill(['password' => Hash::make('secret-password')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $login = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_uuid' => $deviceUuid,
    ]);
    $access = (string) $login->json('access_token');

    $res = $this->getJson('http://'.$host.'/api/v1/mobile/admin/users', [
        'Authorization' => 'Bearer '.$access,
        'X-Device-UUID' => $deviceUuid,
    ]);

    $res->assertOk();
    expect($res->json('data'))->toBeArray()->not->toBeEmpty();
    expect($res->json('data.0.email'))->toBe($tenant->owner_email);
});
