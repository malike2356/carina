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

    $show = $this->getJson('http://'.$host.'/api/v1/mobile/deals/'.$dealId, $headers);
    $show->assertOk()
        ->assertJsonPath('data.id', $dealId)
        ->assertJsonPath('data.title', 'Mobile BTL Test')
        ->assertJsonStructure(['data' => ['metrics', 'property', 'carina_narrative', 'carina_verdict']]);

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

it('lets any workspace member view a deal created by another user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Deals View '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-view-'.uniqid().'@mobile-deals.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    $owner = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $owner->forceFill(['password' => Hash::make('secret-password')])->save();

    $staff = User::factory()->create([
        'email' => 'staff-view-'.uniqid().'@mobile-deals.test',
        'password' => Hash::make('secret-password'),
    ]);

    $deal = DealAnalysis::query()->create([
        'title' => 'Owner deal',
        'strategy' => 'btl',
        'status' => 'draft',
        'created_by' => $owner->id,
        'metrics' => ['purchase_price' => 200000, 'monthly_rent' => 1200],
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $staffLogin = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $staff->email,
        'password' => 'secret-password',
        'device_uuid' => '33333333-3333-3333-3333-333333333333',
    ]);
    $staffLogin->assertOk();
    $headers = ['Authorization' => 'Bearer '.$staffLogin->json('access_token')];

    $show = $this->getJson('http://'.$host.'/api/v1/mobile/deals/'.$deal->id, $headers);
    $show->assertOk()->assertJsonPath('data.title', 'Owner deal');

    $patch = $this->patchJson('http://'.$host.'/api/v1/mobile/deals/'.$deal->id, [
        'title' => 'Staff cannot edit',
    ], $headers);
    $patch->assertForbidden();
});
