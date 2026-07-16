<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\PromoCode;
use App\Models\Central\Subscription;
use App\Models\Central\SubscriptionPlan;
use App\Services\Admin\RevenueAnalyticsService;
use App\Services\Billing\PromoCodeService;
use Database\Seeders\Central\SubscriptionPlanSeeder;

beforeEach(function (): void {
    $this->seed(SubscriptionPlanSeeder::class);
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
});

it('seeds the founder plan at zero price', function (): void {
    $founder = SubscriptionPlan::query()->where('slug', 'founder')->firstOrFail();

    expect($founder->price)->toBe('0.00')
        ->and($founder->name)->toBe('Founder');
});

it('excludes complimentary subscriptions from mrr', function (): void {
    $plan = SubscriptionPlan::query()->where('slug', 'operator')->firstOrFail();

    $paidTenant = createCentralTenant(['plan' => 'operator']);
    Subscription::query()->create([
        'tenant_id' => $paidTenant->id,
        'plan_id' => $plan->id,
        'plan' => 'operator',
        'status' => 'active',
        'is_complimentary' => false,
    ]);

    $compTenant = createCentralTenant(['plan' => 'operator']);
    Subscription::query()->create([
        'tenant_id' => $compTenant->id,
        'plan_id' => $plan->id,
        'plan' => 'operator',
        'status' => 'active',
        'is_complimentary' => true,
    ]);

    app(RevenueAnalyticsService::class)->flushCache();

    expect(app(RevenueAnalyticsService::class)->mrr())->toBe(99.0)
        ->and(app(RevenueAnalyticsService::class)->complimentaryCount())->toBe(1);
});

it('validates promo code state', function (): void {
    $expired = PromoCode::query()->create([
        'code' => 'EXPIRED1',
        'name' => 'Expired',
        'discount_type' => 'free_trial_days',
        'discount_value' => 14,
        'expires_at' => now()->subDay(),
        'is_active' => true,
    ]);

    expect($expired->isValid())->toBeFalse();

    $exhausted = PromoCode::query()->create([
        'code' => 'GONE1',
        'name' => 'Gone',
        'discount_type' => 'free_trial_days',
        'discount_value' => 7,
        'max_uses' => 1,
        'is_active' => true,
    ]);
    PromoCode::query()->whereKey($exhausted->id)->update(['used_count' => 1]);
    $exhausted->refresh();

    expect($exhausted->isValid())->toBeFalse()
        ->and($exhausted->isExhausted())->toBeTrue();
});

it('extends trial when redeeming free trial days', function (): void {
    $promo = PromoCode::query()->create([
        'code' => 'TRIAL30',
        'name' => '30 day trial',
        'discount_type' => 'free_trial_days',
        'discount_value' => 30,
        'is_active' => true,
    ]);

    $tenant = createCentralTenant([
        'trial_ends_at' => now()->addDays(14),
    ]);

    app(PromoCodeService::class)->redeem($promo, $tenant);

    $tenant->refresh();
    expect($tenant->trial_ends_at->isAfter(now()->addDays(40)))->toBeTrue();

    expect(fn () => app(PromoCodeService::class)->redeem($promo->fresh(), $tenant))
        ->toThrow(RuntimeException::class, 'This code has already been used by this workspace.');
});

it('allows platform admin to manage promo codes', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.promo-codes.index'))
        ->assertOk();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.promo-codes.store'), [
            'code' => 'ADMIN50',
            'name' => 'Admin batch',
            'discount_type' => 'percent',
            'discount_value' => 50,
            'is_active' => true,
        ])
        ->assertRedirect(route('admin.promo-codes.index'));

    expect(PromoCode::query()->where('code', 'ADMIN50')->exists())->toBeTrue();
});

it('updates complimentary flag from tenant edit', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $plan = SubscriptionPlan::query()->where('slug', 'operator')->firstOrFail();
    $tenant = createCentralTenant(['plan' => 'operator']);
    Subscription::query()->create([
        'tenant_id' => $tenant->id,
        'plan_id' => $plan->id,
        'plan' => 'operator',
        'status' => 'active',
        'is_complimentary' => false,
    ]);

    $this->actingAs($admin, 'platform')
        ->put(route('admin.saas-tenancy.update', $tenant), [
            'company_name' => $tenant->company_name,
            'owner_name' => $tenant->owner_name,
            'owner_email' => $tenant->owner_email,
            'plan' => 'operator',
            'persona' => $tenant->persona ?? 'mixed',
            'is_active' => true,
            'is_complimentary' => true,
        ])
        ->assertRedirect(route('admin.saas-tenancy.edit', $tenant));

    expect((bool) $tenant->fresh()->subscription?->is_complimentary)->toBeTrue();
});
