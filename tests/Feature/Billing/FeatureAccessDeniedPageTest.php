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
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
});

it('renders a helpful page when deal engine is not on the workspace plan', function (): void {
    $crmOnlyPlan = SubscriptionPlan::on('central')->create([
        'slug' => 'test_crm_only_'.uniqid(),
        'name' => 'CRM only test',
        'price' => '0.00',
        'currency' => 'GBP',
        'interval' => 'month',
        'features' => ['modules' => [BillingModule::Crm->value]],
        'is_active' => false,
        'sort_order' => 999,
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Access Denied '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@access-denied.test',
        'plan' => 'operator',
    ]);

    Tenant::on('central')->whereKey($tenant->id)->update([
        'trial_ends_at' => now()->subDay(),
    ]);

    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $crmOnlyPlan->id,
        'stripe_customer_id' => 'cus_access_denied',
        'stripe_subscription_id' => 'sub_access_denied_'.uniqid(),
        'plan' => $crmOnlyPlan->slug,
        'status' => 'active',
    ]);

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/deals/calculators');

    $response->assertForbidden();
    $response->assertSee('Deal Engine is not available', false);
    $response->assertSee('Back to dashboard', false);
    $response->assertSee('Plans and billing', false);
});

it('renders feature hub guidance when the user profile has deactivated the module', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Profile Off '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile-off.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(\App\Services\Onboarding\UserFeatureProfileService::class)->deactivateModule(
        $user,
        BillingModule::DealEngine,
    );
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/deals/calculators');

    $response->assertForbidden();
    $response->assertSee('Feature preferences', false);
    $response->assertSee('turned off for your user profile', false);
});
