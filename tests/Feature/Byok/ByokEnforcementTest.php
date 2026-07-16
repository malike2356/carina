<?php

declare(strict_types=1);

use App\Exceptions\Byok\ByokKeyMissingException;
use App\Models\Central\PlatformSetting;
use App\Models\Central\SubscriptionPlan;
use App\Models\Central\TenantAiSetting;
use App\Models\Tenant\IntegrationConfig;
use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Integrations\IntegrationProvider;
use App\Support\Integrations\PropertyDataCredentialResolver;
use Database\Seeders\Central\SubscriptionPlanSeeder;

beforeEach(function (): void {
    $this->seed(SubscriptionPlanSeeder::class);

    SubscriptionPlan::on('central')->updateOrCreate(
        ['slug' => 'byok_free_trial'],
        [
            'name' => 'Free Trial BYOK',
            'price' => 0,
            'currency' => 'GBP',
            'interval' => 'month',
            'byok_required' => true,
            'is_active' => true,
            'features' => SubscriptionPlan::on('central')->where('slug', 'operator')->value('features') ?? [],
        ],
    );
});

it('throws ByokKeyMissingException when plan requires BYOK and no tenant AI key', function (): void {
    $tenant = createCentralTenant(['plan' => 'byok_free_trial']);

    expect(fn () => app(AiRuntimeResolutionService::class)->resolve((string) $tenant->id))
        ->toThrow(ByokKeyMissingException::class);
});

it('uses tenant AI key when BYOK plan has override', function (): void {
    $tenant = createCentralTenant(['plan' => 'byok_free_trial']);

    TenantAiSetting::query()->create([
        'tenant_id' => $tenant->id,
        'provider_overrides' => [
            'anthropic' => ['api_key' => 'sk-test-byok-key'],
        ],
    ]);

    $bundle = app(AiRuntimeResolutionService::class)->resolve((string) $tenant->id);

    expect($bundle->providers['anthropic']['api_key'] ?? null)->toBe('sk-test-byok-key');
});

it('falls back to platform PropertyData key when plan does not require BYOK', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'PD Fallback '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pd-'.uniqid().'@test.example',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    config(['services.propertydata.key' => 'platform-pd-key-test']);

    expect(app(PropertyDataCredentialResolver::class)->resolveEffectiveKey())->toBe('platform-pd-key-test');

    tenancy()->end();
});

it('uses platform PropertyData key on BYOK plan when subsidy allows preview', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'propertydata_allow_platform_subsidy'],
        ['value' => '1', 'group' => 'ai'],
    );

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'PD BYOK '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pd-byok-'.uniqid().'@test.example',
        'plan' => 'byok_free_trial',
    ]);

    tenancy()->initialize($tenant);
    config(['services.propertydata.key' => 'platform-pd-key-test']);

    expect(app(PropertyDataCredentialResolver::class)->resolveEffectiveKey())->toBe('platform-pd-key-test');

    tenancy()->end();
});

it('uses tenant PropertyData key on BYOK plan when configured', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'PD Tenant '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pd-tenant-'.uniqid().'@test.example',
        'plan' => 'byok_free_trial',
    ]);

    tenancy()->initialize($tenant);

    IntegrationConfig::query()->create([
        'tenant_id' => (string) $tenant->id,
        'provider' => IntegrationProvider::PropertyData->value,
        'credentials_encrypted' => ['api_key' => 'tenant-pd-key'],
        'is_active' => true,
        'key_status' => 'valid',
    ]);

    expect(app(PropertyDataCredentialResolver::class)->resolveEffectiveKey())->toBe('tenant-pd-key');

    tenancy()->end();
});
