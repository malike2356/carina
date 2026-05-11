<?php

declare(strict_types=1);

use App\Models\Central\AiProvider;
use App\Models\Central\AiUsageLog;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use App\Models\Central\PlatformUser;
use App\Models\Central\TenantAiSetting;
use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Ai\Contracts\AiUsageServiceInterface;
use Illuminate\Support\Facades\Config;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

it('shows ai providers index for platform admin', function (): void {
    $user = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($user, 'platform')
        ->get(route('admin.ai.providers.index'))
        ->assertOk()
        ->assertSee('AI providers', false);
});

it('shows ai usage for platform admin', function (): void {
    $user = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($user, 'platform')
        ->get(route('admin.ai.usage.index'))
        ->assertOk()
        ->assertSee('AI usage', false);
});

it('stores encrypted api keys on ai providers', function (): void {
    $p = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();
    $p->update(['api_key' => 'sk-ant-test-secret']);
    $p->refresh();

    expect($p->api_key)->toBe('sk-ant-test-secret');
    expect(str_contains((string) $p->getRawOriginal('api_key'), 'sk-ant'))->toBeFalse();
});

it('merges registry keys into runtime resolution', function (): void {
    Config::set('ai.providers.anthropic.api_key', null);

    $p = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();
    $p->update([
        'api_key' => 'sk-ant-from-registry',
        'is_enabled' => true,
    ]);

    $bundle = app(AiRuntimeResolutionService::class)->resolve(null);

    expect($bundle->providers['anthropic']['api_key'] ?? null)->toBe('sk-ant-from-registry');
});

it('logs ai usage through ai usage service', function (): void {
    $provider = AiProvider::query()->where('slug', 'groq')->firstOrFail();

    app(AiUsageServiceInterface::class)->logInvocation(
        'groq',
        'llama-test',
        10,
        20,
        100,
        null,
        null,
        null,
        [],
    );

    expect(AiUsageLog::query()->where('provider_slug', 'groq')->count())->toBe(1);

    $log = AiUsageLog::query()->firstOrFail();
    expect($log->ai_provider_id)->toBe($provider->id);
});

it('blocks deleting a built-in ai provider slug', function (): void {
    $user = PlatformUser::factory()->superAdmin()->create();
    $provider = AiProvider::query()->where('slug', 'anthropic')->firstOrFail();

    $this->actingAs($user, 'platform')
        ->from(route('admin.ai.providers.index'))
        ->delete(route('admin.ai.providers.destroy', $provider))
        ->assertRedirect(route('admin.ai.providers.index'))
        ->assertSessionHas('error');

    expect(AiProvider::query()->where('slug', 'anthropic')->exists())->toBeTrue();
});

it('encrypts tenant ai provider overrides at rest', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'byok_enabled'],
        ['group' => 'ai', 'value' => '1', 'type' => 'boolean', 'label' => 'BYOK', 'description' => null, 'is_encrypted' => false, 'is_public' => false],
    );

    $tenant = createCentralTenant(['slug' => 'byok-test-'.uniqid()]);

    $setting = TenantAiSetting::query()->create([
        'tenant_id' => $tenant->id,
        'default_ai_provider_id' => null,
        'provider_overrides' => [
            'openai' => ['api_key' => 'sk-openai-secret'],
        ],
    ]);

    $setting->refresh();
    expect($setting->provider_overrides['openai']['api_key'] ?? null)->toBe('sk-openai-secret');

    $raw = $setting->getRawOriginal('provider_overrides');
    expect(is_string($raw) && ! str_contains((string) $raw, 'sk-openai'))->toBeTrue();
});
