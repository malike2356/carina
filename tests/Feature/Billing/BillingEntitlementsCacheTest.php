<?php

declare(strict_types=1);

use App\Events\Billing\SubscriptionUpdated;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Services\Billing\Contracts\SubscriptionServiceInterface;
use Database\Seeders\Central\SubscriptionPlanSeeder;

beforeEach(function () {
    $this->seed(SubscriptionPlanSeeder::class);
});

it('serves stale billing summary until the entitlements cache is cleared', function () {
    $tenant = createCentralTenant(['trial_ends_at' => now()->subDay()]);
    $operatorId = SubscriptionPlan::on('central')->where('slug', 'operator')->value('id');
    $mentorId = SubscriptionPlan::on('central')->where('slug', 'studio')->value('id');

    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $operatorId,
        'stripe_customer_id' => 'cus_cache_test',
        'stripe_subscription_id' => 'sub_cache_test',
        'plan' => 'operator',
        'status' => 'active',
    ]);

    $svc = app(SubscriptionServiceInterface::class);

    $first = $svc->getBillingSummary($tenant->id);
    expect($first['phase'])->toBe('subscribed')
        ->and($first['plan_slug'])->toBe('operator');

    Subscription::on('central')->where('tenant_id', $tenant->id)->update([
        'plan_id' => $mentorId,
        'plan' => 'studio',
    ]);

    $stale = $svc->getBillingSummary($tenant->id);
    expect($stale['plan_slug'])->toBe('operator');

    $svc->forgetBillingEntitlementsCache($tenant->id);

    $fresh = $svc->getBillingSummary($tenant->id);
    expect($fresh['plan_slug'])->toBe('studio');
});

it('clears billing entitlements cache when subscription updated event fires', function () {
    $tenant = createCentralTenant(['trial_ends_at' => now()->subDay()]);
    $operatorId = SubscriptionPlan::on('central')->where('slug', 'operator')->value('id');
    $mentorId = SubscriptionPlan::on('central')->where('slug', 'studio')->value('id');

    $sub = Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $operatorId,
        'stripe_customer_id' => 'cus_evt_test',
        'stripe_subscription_id' => 'sub_evt_test',
        'plan' => 'operator',
        'status' => 'active',
    ]);

    $svc = app(SubscriptionServiceInterface::class);
    expect($svc->getBillingSummary($tenant->id)['plan_slug'])->toBe('operator');

    $sub->update(['plan_id' => $mentorId, 'plan' => 'studio']);
    SubscriptionUpdated::dispatch($sub->fresh());

    expect($svc->getBillingSummary($tenant->id)['plan_slug'])->toBe('studio');
});
