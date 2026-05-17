<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
});

it('does not block module routes when stripe billing api is disabled', function () {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Gate Off '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@gate-off.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/properties')->assertOk();
});

it('blocks properties for an active investor subscription when billing api is enabled and trial has ended', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Investor Gate '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@investor-gate.test',
        'plan' => 'starter',
    ]);

    $tenant->trial_ends_at = now()->subDay();
    $tenant->save();

    // investor plan does not include multi_property — /properties should be gated
    $investorId = SubscriptionPlan::on('central')->where('slug', 'investor')->value('id');
    expect($investorId)->not->toBeNull();

    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $investorId,
        'stripe_customer_id' => 'cus_test_gate',
        'stripe_subscription_id' => 'sub_test_gate_'.uniqid(),
        'plan' => 'investor',
        'status' => 'active',
        'trial_ends_at' => null,
        'current_period_start' => now(),
        'current_period_end' => now()->addMonth(),
        'cancel_at_period_end' => false,
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->password = Hash::make('secret');
    $user->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/properties')->assertForbidden();
});
