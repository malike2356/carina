<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CommunityDealShare;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => false, 'tenant_overrides' => null]);
});

it('loads the deal swap board with deal engine only (not community learning)', function (): void {
    $host = actingAsTenant();

    $this->get('http://'.$host.'/community/deal-shares')
        ->assertOk()
        ->assertSee('Deal Swap', false);
});

it('lists public deal shares on the board', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Swap Board '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@swap-board.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    CommunityDealShare::query()->create([
        'tenant_id' => (string) tenant('id'),
        'user_id' => $user->id,
        'title' => 'Swap me a BRR in Leeds',
        'summary' => 'Looking to hand off to a northern operator.',
        'is_public' => true,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/community/deal-shares')
        ->assertOk()
        ->assertSee('Swap me a BRR in Leeds', false);
});
