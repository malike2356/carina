<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Support\Integrations\PropertyDataCredentialResolver;

it('prefers platform_settings key over services config', function (): void {
    config(['services.propertydata.key' => 'env-fallback']);

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'propertydata_platform_api_key'],
        [
            'group' => 'integrations',
            'value' => 'platform-from-db',
            'type' => 'string',
            'label' => 'Test',
            'description' => null,
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );

    $resolver = new PropertyDataCredentialResolver;

    expect($resolver->resolveEffectiveKey())->toBe('platform-from-db');
});

it('falls back to config when platform key is empty', function (): void {
    config(['services.propertydata.key' => 'env-only']);

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'propertydata_platform_api_key'],
        [
            'group' => 'integrations',
            'value' => '',
            'type' => 'string',
            'label' => 'Test',
            'description' => null,
            'is_encrypted' => false,
            'is_public' => false,
        ]
    );

    expect((new PropertyDataCredentialResolver)->resolveEffectiveKey())->toBe('env-only');
});
