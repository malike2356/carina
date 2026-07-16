<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
    // Other billing tests may leave this disabled; subscriptions routes require it on.
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);
});

it('renders the subscriptions manager for tenant admins when stripe billing api is on', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Subs Page '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@subs-page.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/settings/subscriptions')
        ->assertOk()
        ->assertSee(__('billing.subscriptions.page_title'), false)
        ->assertSee(__('billing.dashboard.card_title'), false);
});

it('returns 403 when the user is not a workspace administrator', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Subs 403 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@subs-403.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $peer = User::factory()->create([
        'name' => 'Member',
        'email' => 'member-'.uniqid().'@subs-403.test',
    ]);
    $peer->syncRoles(['mentee']);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($peer, 'web');

    $this->get('http://'.$host.'/settings/subscriptions')->assertForbidden();
});

it('returns 404 when stripe billing api is disabled', function (): void {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Subs 404 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@subs-404.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/settings/subscriptions')->assertNotFound();
});
