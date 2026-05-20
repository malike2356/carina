<?php

declare(strict_types=1);

use App\Models\Tenant\TenantSetting;
use App\Services\Tenancy\TenantCreationService;

beforeEach(function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Settings '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@settings.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
});

afterEach(function (): void {
    tenancy()->end();
});

it('reads and writes boolean tenant settings', function (): void {
    TenantSetting::setValue('byok_upgrade_notice_dismissed', true, 'byok');

    expect(TenantSetting::getValue('byok_upgrade_notice_dismissed', false))->toBeTrue();
});

it('returns default when key is missing', function (): void {
    expect(TenantSetting::getValue('missing_key_xyz', 'fallback'))->toBe('fallback');
});
