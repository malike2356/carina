<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;

beforeEach(function () {
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
});

it('redirects subscription plans index when the user cannot access the admin shell', function () {
    $u = PlatformUser::factory()->create([
        'role' => 'external_auditor',
    ]);

    $this->actingAs($u, 'platform')
        ->get(route('admin.subscription-plans.index'))
        ->assertRedirect(route('central.login'));
});

it('shows subscription plans index for super admin', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    SubscriptionPlan::on('central')->create([
        'name' => 'Test Plan',
        'slug' => 'test-plan-x',
        'price' => '10.00',
        'currency' => 'GBP',
        'interval' => 'month',
        'stripe_price_id' => null,
        'features' => ['display_name' => 'Test Plan', 'modules' => [], 'limits' => []],
        'is_active' => true,
        'sort_order' => 0,
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.subscription-plans.index'))
        ->assertOk()
        ->assertSee('Test Plan')
        ->assertSee('test-plan-x');
});

it('creates a plan via store', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.subscription-plans.store'), [
            'name' => 'Operator',
            'slug' => 'operator-test',
            'display_name' => 'Operator',
            'price' => '49',
            'currency' => 'gbp',
            'interval' => 'month',
            'stripe_price_id' => 'price_test123ABC',
            'modules' => ['deal_engine', 'crm'],
            'limits_json' => '{"max_properties": 50}',
            'is_active' => '1',
            'sort_order' => '5',
        ])
        ->assertRedirect(route('admin.subscription-plans.index'));

    $row = SubscriptionPlan::on('central')->where('slug', 'operator-test')->first();
    expect($row)->not->toBeNull()
        ->and($row->currency)->toBe('GBP')
        ->and($row->features['modules'])->toContain('deal_engine')
        ->and($row->features['limits'])->toMatchArray(['max_properties' => 50]);
});

it('forbids store for view-only user', function () {
    $u = PlatformUser::factory()->create([
        'role' => PlatformUser::ROLE_SUPPORT,
    ]);

    $this->actingAs($u, 'platform')
        ->post(route('admin.subscription-plans.store'), [
            'name' => 'X',
            'slug' => 'x-only-view',
            'price' => '1',
            'currency' => 'GBP',
            'interval' => 'month',
        ])
        ->assertForbidden();
});

it('blocks delete when an active subscription references the plan', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $plan = SubscriptionPlan::on('central')->create([
        'name' => 'Locked',
        'slug' => 'locked-plan',
        'price' => '1',
        'currency' => 'GBP',
        'interval' => 'month',
        'features' => ['display_name' => 'Locked', 'modules' => [], 'limits' => []],
        'is_active' => true,
        'sort_order' => 0,
    ]);
    $tenant = createCentralTenant();
    Subscription::on('central')->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $plan->id,
        'plan' => 'starter',
        'status' => 'active',
    ]);

    $this->actingAs($admin, 'platform')
        ->delete(route('admin.subscription-plans.destroy', $plan))
        ->assertRedirect(route('admin.subscription-plans.index'))
        ->assertSessionHasErrors('plan');

    expect(SubscriptionPlan::on('central')->where('id', $plan->id)->exists())->toBeTrue();
});

it('deletes a plan when no active subscriptions reference it', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $plan = SubscriptionPlan::on('central')->create([
        'name' => 'Orphan',
        'slug' => 'orphan-plan',
        'price' => '1',
        'currency' => 'GBP',
        'interval' => 'month',
        'features' => ['display_name' => 'Orphan', 'modules' => [], 'limits' => []],
        'is_active' => true,
        'sort_order' => 0,
    ]);

    $this->actingAs($admin, 'platform')
        ->delete(route('admin.subscription-plans.destroy', $plan))
        ->assertRedirect(route('admin.subscription-plans.index'));

    expect(SubscriptionPlan::on('central')->where('id', $plan->id)->exists())->toBeFalse();
});
