<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Services\Billing\Contracts\FeatureGatingServiceInterface;
use App\Support\Navigation\TenantNavModuleAccess;
use Illuminate\Support\Str;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

it('skips subscription gating when stripe billing API flag is off', function (): void {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'integrations')->update(['enabled' => true]);

    $mock = mock(FeatureGatingServiceInterface::class);
    $mock->shouldNotReceive('hasFeature');
    $this->app->instance(FeatureGatingServiceInterface::class, $mock);

    $tenant = Tenant::query()->create([
        'id' => (string) Str::uuid(),
        'slug' => 'nav-test',
        'company_name' => 'Nav Test',
        'owner_name' => 'T',
        'owner_email' => 't@nav.test',
        'plan' => 'starter',
        'is_active' => true,
    ]);

    $map = app(TenantNavModuleAccess::class)->mapForTenant($tenant);

    expect($map[BillingModule::DealEngine->value])->toBeTrue();
    expect($map[BillingModule::Integrations->value])->toBeTrue();
});

it('applies subscription gating when stripe billing API is on', function (): void {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);

    $tenant = Tenant::query()->create([
        'id' => (string) Str::uuid(),
        'slug' => 'nav-gate',
        'company_name' => 'Nav Gate',
        'owner_name' => 'T',
        'owner_email' => 't@gate.test',
        'plan' => 'starter',
        'is_active' => true,
    ]);

    $mock = mock(FeatureGatingServiceInterface::class);
    $mock->shouldReceive('hasFeature')
        ->zeroOrMoreTimes()
        ->andReturnUsing(fn (string $tid, string $feature): bool => $feature !== BillingModule::DealEngine->value);
    $this->app->instance(FeatureGatingServiceInterface::class, $mock);

    $map = app(TenantNavModuleAccess::class)->mapForTenant($tenant);

    expect($map[BillingModule::DealEngine->value])->toBeFalse();
});
