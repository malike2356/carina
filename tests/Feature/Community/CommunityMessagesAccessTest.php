<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'communications_hub')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
});

it('loads community messages with communications hub when plan lacks community learning', function (): void {
    $operatorId = SubscriptionPlan::on('central')->where('slug', 'operator')->value('id');
    $modules = SubscriptionPlan::on('central')->whereKey($operatorId)->value('features');
    $moduleList = is_array($modules['modules'] ?? null) ? $modules['modules'] : [];
    expect($moduleList)->toContain(BillingModule::DealEngine->value)
        ->and($moduleList)->not->toContain(BillingModule::CommunityLearning->value);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Messages Access '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@messages-access.test',
        'plan' => 'operator',
    ]);

    Tenant::on('central')->whereKey($tenant->id)->update(['trial_ends_at' => now()->subDay()]);

    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $operatorId,
        'stripe_customer_id' => 'cus_messages_access',
        'stripe_subscription_id' => 'sub_messages_access_'.uniqid(),
        'plan' => 'operator',
        'status' => 'active',
    ]);

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/community/messages')
        ->assertOk()
        ->assertSee('Messages', false);
});
