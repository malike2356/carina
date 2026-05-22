<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates reads updates and deletes a compliance item via the mobile API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Compliance '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-comp.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-comp')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-comp',
        'device_uuid' => 'dddddddd-4444-4444-4444-dddddddddddd',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $create = $this->postJson('http://'.$host.'/api/v1/mobile/compliance/items', [
        'title' => 'Gas Safety Certificate',
        'category' => 'safety',
        'type' => 'certificate',
        'status' => 'valid',
        'expires_at' => now()->addYear()->toDateString(),
    ], $headers);
    $create->assertCreated()
        ->assertJsonPath('data.title', 'Gas Safety Certificate')
        ->assertJsonPath('data.category', 'safety');

    $itemId = (int) $create->json('data.id');

    $this->getJson('http://'.$host.'/api/v1/mobile/compliance/items/'.$itemId, $headers)
        ->assertOk()
        ->assertJsonPath('data.status', 'valid');

    $this->putJson('http://'.$host.'/api/v1/mobile/compliance/items/'.$itemId, [
        'title' => 'Gas Safety Certificate',
        'category' => 'safety',
        'type' => 'certificate',
        'status' => 'expiring_soon',
    ], $headers)
        ->assertOk()
        ->assertJsonPath('data.status', 'expiring_soon');

    $this->deleteJson('http://'.$host.'/api/v1/mobile/compliance/items/'.$itemId, [], $headers)
        ->assertNoContent();
});

it('lists compliance items with pagination', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Compliance List '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-comp-list.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-comp-list')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-comp-list',
        'device_uuid' => 'eeeeeeee-5555-5555-5555-eeeeeeeeeeee',
    ])->assertOk()->json('access_token');

    $this->getJson('http://'.$host.'/api/v1/mobile/compliance/items', ['Authorization' => 'Bearer '.$token])
        ->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
});
