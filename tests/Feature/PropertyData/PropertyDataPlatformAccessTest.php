<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Services\PropertyData\PropertyDataPlatformAccessService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Integrations\PropertyDataCredentialResolver;
use Illuminate\Support\Facades\Redis;

beforeEach(function (): void {
    config([
        'propertydata.platform_access.trial_due_diligence_runs' => 2,
        'propertydata.platform_access.byok_preview_due_diligence_runs' => 1,
    ]);
});

it('allows trial tenants to use platform PropertyData key within quota', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'propertydata_allow_platform_subsidy'],
        ['value' => '1', 'group' => 'ai'],
    );

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'PD Trial '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pd-trial-'.uniqid().'@test.example',
        'plan' => 'starter',
    ]);

    $tenantId = (string) $tenant->getTenantKey();
    Redis::del('propertydata:platform_dd:'.$tenantId.':lifetime');

    config(['services.propertydata.key' => 'platform-pd-key-test']);

    tenancy()->initialize($tenant);

    expect(app(PropertyDataCredentialResolver::class)->resolveEffectiveKey())->toBe('platform-pd-key-test');

    $access = app(PropertyDataPlatformAccessService::class);
    $access->recordDueDiligenceRun($tenantId);
    $access->recordDueDiligenceRun($tenantId);

    expect($access->status($tenantId, true)['exhausted'])->toBeTrue();
    expect(fn () => $access->assertCanUsePlatformKey($tenantId))
        ->toThrow(\App\Exceptions\PropertyData\PropertyDataPlatformQuotaExceededException::class);

    tenancy()->end();
});

it('blocks platform key when platform subsidy is disabled', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'propertydata_allow_platform_subsidy'],
        ['value' => '0', 'group' => 'ai'],
    );

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'PD Off '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pd-off-'.uniqid().'@test.example',
        'plan' => 'starter',
    ]);

    config(['services.propertydata.key' => 'platform-pd-key-test']);

    tenancy()->initialize($tenant);

    expect(app(PropertyDataCredentialResolver::class)->resolveEffectiveKey())->toBe('');

    tenancy()->end();
});
