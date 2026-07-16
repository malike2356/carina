<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformCarinaConversation;
use App\Models\Central\PlatformUser;
use App\Services\Carina\PlatformCarinaToolRegistry;
use App\Services\Carina\PlatformTools\PlatformGetTenantTool;
use App\Services\Carina\PlatformTools\PlatformListTenantsTool;
use App\Services\Carina\PlatformTools\PlatformToggleFeatureFlagTool;
use App\Services\Carina\Tools\ToolResult;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

it('platform list tenants tool returns workspace list', function (): void {
    createCentralTenant(['slug' => 'plat-test-a', 'company_name' => 'A Ltd']);
    createCentralTenant(['slug' => 'plat-test-b', 'company_name' => 'B Ltd']);

    $admin = PlatformUser::factory()->superAdmin()->create();
    $conversation = PlatformCarinaConversation::query()->create([
        'platform_user_id' => $admin->id,
        'title' => 'Test',
    ]);

    $tool = new PlatformListTenantsTool;
    $result = $tool->execute(['limit' => 50], $admin, $conversation);
    expect($result)->toBeInstanceOf(ToolResult::class);
    expect($result->success)->toBeTrue();
    $slugs = collect($result->data['tenants'] ?? [])->pluck('slug')->all();
    expect($slugs)->toContain('plat-test-a');
    expect($slugs)->toContain('plat-test-b');
});

it('platform toggle feature flag tool requires confirmation', function (): void {
    $tool = new PlatformToggleFeatureFlagTool;
    expect($tool->requiresConfirmation())->toBeTrue();
});

it('platform get tenant tool returns not found for unknown slug', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $conversation = PlatformCarinaConversation::query()->create([
        'platform_user_id' => $admin->id,
        'title' => 'Test',
    ]);
    $tool = new PlatformGetTenantTool;
    $result = $tool->execute(['slug' => 'nonexistent-workspace-xyz'], $admin, $conversation);
    expect($result->success)->toBeFalse();
});

it('platform carina sendmessage returns 503 when no ai provider', function (): void {
    // Blank all provider api_keys in both the DB model rows and the config() cache.
    // Config is used as the base layer by AiRuntimeResolutionService::baseProviders(); DB rows
    // only override when hasConfiguredKey() is true. Both must be cleared to get a real 503.
    $configProviders = config('ai.providers', []);
    $blankProviders = array_map(function (array $p): array {
        $p['api_key'] = null;

        return $p;
    }, $configProviders);
    config(['ai.providers' => $blankProviders]);

    foreach (AiProvider::query()->get() as $p) {
        $p->forceFill(['api_key' => null])->saveQuietly();
    }

    $admin = PlatformUser::factory()->superAdmin()->create();
    $conversation = PlatformCarinaConversation::query()->create([
        'platform_user_id' => $admin->id,
        'title' => 'Test',
    ]);

    $this->actingAs($admin, 'platform')
        ->postJson(route('admin.carina.message', $conversation), [
            'message' => 'Hello',
        ])
        ->assertStatus(503);

    // Restore config for any subsequent tests in this process.
    config(['ai.providers' => $configProviders]);
});

it('registers thirteen platform carina tools', function (): void {
    expect(count(app(PlatformCarinaToolRegistry::class)->all()))->toBe(13);
});
