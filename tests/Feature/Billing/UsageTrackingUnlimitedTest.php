<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Models\Central\SubscriptionUsage;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;
use App\Services\Billing\Contracts\UsageTrackingServiceInterface;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
});

it('treats null plan limits as unlimited usage', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor Usage '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-usage.test',
        'plan' => 'starter',
    ]);

    $mentorPlan = SubscriptionPlan::on('central')->where('slug', 'mentor_network')->first();
    expect($mentorPlan)->not->toBeNull();
    expect($mentorPlan->features['limits']['properties'] ?? null)->toBeNull();

    $subscription = Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $mentorPlan->id,
        'stripe_customer_id' => 'cus_usage_test',
        'stripe_subscription_id' => 'sub_usage_test_'.uniqid(),
        'plan' => 'mentor_network',
        'status' => 'active',
        'trial_ends_at' => null,
        'current_period_start' => now(),
        'current_period_end' => now()->addMonth(),
        'cancel_at_period_end' => false,
    ]);

    $start = Carbon::now()->startOfMonth();
    $end = Carbon::now()->endOfMonth();

    SubscriptionUsage::on('central')->create([
        'subscription_id' => $subscription->id,
        'feature' => 'properties',
        'usage_count' => 500_000,
        'period_start' => $start,
        'period_end' => $end,
    ]);

    $usage = app(UsageTrackingServiceInterface::class);

    expect($usage->checkUsageLimits($tenant->id, 'properties'))->toBeTrue();
});

it('includes mentoring_os during trial when trial module set contains it', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Trial Modules '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@trial-modules.test',
        'plan' => 'starter',
    ]);

    expect($tenant->isOnTrial())->toBeTrue();

    $svc = app(SubscriptionServiceInterface::class);

    expect($svc->checkFeatureAccess($tenant->id, BillingModule::MultiProperty->value))->toBeTrue();
    expect($svc->checkFeatureAccess($tenant->id, BillingModule::MentoringOs->value))->toBeTrue();
});
