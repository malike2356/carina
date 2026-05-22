<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates archives deals and exposes refurb lines on the mobile API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Deals '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-deals.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $login = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_uuid' => '22222222-2222-2222-2222-222222222222',
    ]);
    $login->assertOk();
    $headers = ['Authorization' => 'Bearer '.$login->json('access_token')];

    $create = $this->postJson('http://'.$host.'/api/v1/mobile/deals', [
        'strategy' => 'btl',
        'title' => 'Mobile BTL Test',
        'metrics' => ['purchase_price' => 150000, 'monthly_rent' => 900],
    ], $headers);
    $create->assertCreated()
        ->assertJsonPath('data.title', 'Mobile BTL Test');

    $dealId = (int) $create->json('data.id');

    $refurbList = $this->getJson('http://'.$host.'/api/v1/mobile/deals/'.$dealId.'/refurb', $headers);
    $refurbList->assertOk()->assertJsonStructure(['data', 'rollup_total']);

    $refurbAdd = $this->postJson('http://'.$host.'/api/v1/mobile/deals/'.$dealId.'/refurb', [
        'description' => 'Kitchen refit',
        'quantity' => 1,
        'unit_cost' => 5000,
    ], $headers);
    $refurbAdd->assertCreated();

    $delete = $this->deleteJson('http://'.$host.'/api/v1/mobile/deals/'.$dealId, [], $headers);
    $delete->assertOk();

    tenancy()->initialize($tenant);
    expect(DealAnalysis::query()->find($dealId))->toBeNull();
    tenancy()->end();
});
