<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use App\Support\Ai\TenantByok;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

it('returns false when byok feature flag is off', function (): void {
    FeatureFlag::query()->where('key', 'byok_ai')->update(['enabled' => false]);

    expect(TenantByok::isEnabled())->toBeFalse();

    FeatureFlag::query()->where('key', 'byok_ai')->update(['enabled' => true]);
});

it('returns false when platform byok_enabled is off', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'byok_enabled'],
        ['group' => 'ai', 'value' => '0', 'type' => 'boolean', 'label' => 'BYOK', 'description' => null, 'is_encrypted' => false, 'is_public' => false],
    );

    expect(TenantByok::isEnabled())->toBeFalse();
});

it('returns true when flag and platform toggle are on', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'byok_enabled'],
        ['group' => 'ai', 'value' => '1', 'type' => 'boolean', 'label' => 'BYOK', 'description' => null, 'is_encrypted' => false, 'is_public' => false],
    );

    expect(TenantByok::isEnabled())->toBeTrue();
});
