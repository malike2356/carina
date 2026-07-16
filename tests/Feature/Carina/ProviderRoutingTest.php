<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Central\TenantAiSetting;
use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Carina\CarinaProviderRoutingService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
});

it('returns null when routing flag is off', function (): void {
    FeatureFlag::query()->where('key', 'carina_provider_routing_v2')->update(['enabled' => false]);

    $routing = app(CarinaProviderRoutingService::class);
    $override = $routing->resolveOverride(null, 'Draft a Section 21 notice', [], null);

    expect($override)->toBeNull();
});

it('prefers anthropic for legal keywords when flag is on and key exists', function (): void {
    FeatureFlag::query()->where('key', 'carina_provider_routing_v2')->update(['enabled' => true]);

    $anthropic = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();
    $anthropic->update(['api_key' => 'sk-ant-test', 'is_enabled' => true]);

    $tenant = createCentralTenant();
    $routing = app(CarinaProviderRoutingService::class);

    $override = $routing->resolveOverride(
        null,
        'Please review our Section 21 process for this tenancy',
        [],
        (string) $tenant->id,
    );

    expect($override)->toBe('anthropic');
});

it('respects conversation model override over legal routing', function (): void {
    FeatureFlag::query()->where('key', 'carina_provider_routing_v2')->update(['enabled' => true]);

    $anthropic = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();
    $anthropic->update(['api_key' => 'sk-ant-test', 'is_enabled' => true]);

    $tenant = createCentralTenant();
    $routing = app(CarinaProviderRoutingService::class);

    $override = $routing->resolveOverride(
        'groq',
        'Draft Section 8 grounds for rent arrears',
        [],
        (string) $tenant->id,
    );

    expect($override)->toBe('groq');
});

it('prefers anthropic when a legal tool already ran in the action log', function (): void {
    FeatureFlag::query()->where('key', 'carina_provider_routing_v2')->update(['enabled' => true]);

    $anthropic = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();
    $anthropic->update(['api_key' => 'sk-ant-test', 'is_enabled' => true]);

    $tenant = createCentralTenant();
    $routing = app(CarinaProviderRoutingService::class);

    $override = $routing->resolveOverride(
        null,
        'Summarise what we found',
        [['tool' => 'get_compliance_items', 'args' => [], 'result' => 'ok', 'success' => true]],
        (string) $tenant->id,
    );

    expect($override)->toBe('anthropic');
});

it('returns null when anthropic key is missing even with legal keywords', function (): void {
    FeatureFlag::query()->where('key', 'carina_provider_routing_v2')->update(['enabled' => true]);

    $anthropic = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();
    $anthropic->update(['api_key' => null, 'is_enabled' => false]);

    $tenant = createCentralTenant();
    $routing = app(CarinaProviderRoutingService::class);

    $override = $routing->resolveOverride(
        null,
        'HMO licence renewal deadline',
        [],
        (string) $tenant->id,
    );

    expect($override)->toBeNull();
});

it('uses tenant BYOK anthropic key when platform registry key is empty', function (): void {
    FeatureFlag::query()->where('key', 'carina_provider_routing_v2')->update(['enabled' => true]);

    $anthropic = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();
    $anthropic->update(['api_key' => null, 'is_enabled' => true]);

    $tenant = createCentralTenant();
    $anthropicId = $anthropic->id;

    TenantAiSetting::query()->create([
        'tenant_id' => $tenant->id,
        'default_ai_provider_id' => $anthropicId,
        'provider_overrides' => [
            'anthropic' => [
                'api_key' => 'sk-ant-byok-tenant',
                'base_url' => 'https://api.anthropic.com/v1',
                'model' => 'claude-sonnet-4-20250514',
            ],
        ],
    ]);

    $bundle = app(AiRuntimeResolutionService::class)->resolve((string) $tenant->id);
    expect($bundle->providers['anthropic']['api_key'] ?? null)->toBe('sk-ant-byok-tenant');

    $routing = app(CarinaProviderRoutingService::class);
    $override = $routing->resolveOverride(
        null,
        'Gas safety certificate expiry rules',
        [],
        (string) $tenant->id,
    );

    expect($override)->toBe('anthropic');
});
