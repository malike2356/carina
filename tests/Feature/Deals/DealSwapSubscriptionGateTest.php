<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Models\Central\Tenant;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true, 'tenant_overrides' => null]);
});

it('allows deal swap when subscription has deal engine but not community learning', function (): void {
    $operator = SubscriptionPlan::on('central')->where('slug', 'operator')->first();
    expect($operator)->not->toBeNull();

    $modules = is_array($operator->features['modules'] ?? null) ? $operator->features['modules'] : [];
    expect($modules)->toContain(BillingModule::DealEngine->value)
        ->and($modules)->not->toContain(BillingModule::CommunityLearning->value);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Swap Gate '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@swap-gate.test',
        'plan' => 'operator',
    ]);

    Tenant::on('central')->whereKey($tenant->id)->update([
        'trial_ends_at' => now()->subDay(),
    ]);

    $operatorId = SubscriptionPlan::on('central')->where('slug', 'operator')->value('id');
    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $operatorId,
        'stripe_customer_id' => 'cus_swap_gate_test',
        'stripe_subscription_id' => 'sub_swap_gate_test_'.uniqid(),
        'plan' => 'operator',
        'status' => 'active',
    ]);

    $host = actingAsTenant($tenant);

    $this->get('http://'.$host.'/community/deal-shares')
        ->assertOk()
        ->assertSee('Deal Swap', false);
});
