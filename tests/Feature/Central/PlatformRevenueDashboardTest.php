<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Invoice;
use App\Models\Central\PlatformUser;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Services\Admin\RevenueAnalyticsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'platform_revenue_dashboard')->update(['enabled' => true]);
});

it('shows revenue snapshot on the platform dashboard', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertSee('Revenue snapshot', false)
        ->assertSee('MRR', false);
});

it('renders the dedicated revenue page for authorised admins', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Revenue Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@revenue.test',
        'plan' => 'starter',
    ]);

    $plan = SubscriptionPlan::on('central')->create([
        'name' => 'Pro',
        'slug' => 'pro-revenue-'.uniqid(),
        'price' => '99.00',
        'currency' => 'GBP',
        'interval' => 'month',
        'features' => [],
        'is_active' => true,
        'sort_order' => 99,
    ]);

    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $plan->id,
        'stripe_customer_id' => 'cus_rev_'.uniqid(),
        'stripe_subscription_id' => 'sub_rev_'.uniqid(),
        'plan' => $plan->slug,
        'status' => 'active',
        'current_period_start' => now()->subWeek(),
        'current_period_end' => now()->addWeek(),
    ]);

    Invoice::on('central')->create([
        'tenant_id' => $tenant->id,
        'amount' => 99.00,
        'currency' => 'GBP',
        'status' => 'paid',
        'paid_at' => now(),
    ]);

    app(RevenueAnalyticsService::class)->flushCache();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.revenue.index'))
        ->assertOk()
        ->assertSee('Revenue overview', false)
        ->assertSee('Pro', false)
        ->assertSee('Paid invoices', false);
});

it('blocks revenue page when feature flag is off', function (): void {
    FeatureFlag::query()->where('key', 'platform_revenue_dashboard')->update(['enabled' => false]);
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.revenue.index'))
        ->assertForbidden();
});
