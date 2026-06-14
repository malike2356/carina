<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Ai\AiRuntimeResolutionService;
use App\Services\Ai\Dto\AiRuntimeBundle;
use App\Services\Carina\AiRouterService;
use App\Services\Carina\CarinaModelSlashCommandService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Config;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    Config::set('ai.providers.anthropic.api_key', 'sk-ant-test');
    Config::set('ai.providers.deepseek.api_key', 'sk-deepseek-test');
    Config::set('ai.providers.groq.api_key', 'gsk-test');
});

/**
 * @return array{0: Tenant, 1: User, 2: string}
 */
function modelSlashTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Model Slash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@model-slash.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $tenantKey = (string) $tenant->getTenantKey();
    tenancy()->end();

    return [$tenant, $user, $tenantKey];
}

it('lists providers when /model is sent with no args', function (): void {
    [$tenant, $user, $tenantKey] = modelSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenantKey,
        'user_id' => $user->id,
        'title' => 'Model slash thread',
    ]);

    $reply = app(CarinaModelSlashCommandService::class)->tryHandle('/model', $conversation);

    expect($reply)->not->toBeNull()
        ->and($reply)->toContain('Available providers:')
        ->and($reply)->toContain('anthropic')
        ->and($reply)->toContain('deepseek')
        ->and($reply)->toContain('Type /model <name> to switch for this conversation.')
        ->and($reply)->toContain('Current:');

    tenancy()->end();
});

it('switches provider and stores override on conversation', function (): void {
    [$tenant, $user, $tenantKey] = modelSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenantKey,
        'user_id' => $user->id,
        'title' => 'Switch thread',
    ]);

    $reply = app(CarinaModelSlashCommandService::class)->tryHandle('/model anthropic', $conversation);
    $conversation->refresh();

    expect($reply)->not->toBeNull()
        ->and($reply)->toContain('Switched to anthropic')
        ->and($conversation->model_override)->toBe('anthropic');

    tenancy()->end();
});

it('rejects unknown provider slug', function (): void {
    [$tenant, $user, $tenantKey] = modelSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenantKey,
        'user_id' => $user->id,
        'title' => 'Unknown provider thread',
    ]);

    $reply = app(CarinaModelSlashCommandService::class)->tryHandle('/model not-a-real-provider', $conversation);
    $conversation->refresh();

    expect($reply)->not->toBeNull()
        ->and($reply)->toContain('Unknown provider')
        ->and($conversation->model_override)->toBeNull();

    tenancy()->end();
});

it('resets override when /model reset is sent', function (): void {
    [$tenant, $user, $tenantKey] = modelSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenantKey,
        'user_id' => $user->id,
        'title' => 'Reset thread',
        'model_override' => 'anthropic',
    ]);

    $reply = app(CarinaModelSlashCommandService::class)->tryHandle('/model reset', $conversation);
    $conversation->refresh();

    expect($reply)->not->toBeNull()
        ->and($reply)->toContain('Model reset. Using workspace default')
        ->and($conversation->model_override)->toBeNull();

    tenancy()->end();
});

it('accepts claude alias for anthropic', function (): void {
    [$tenant, $user, $tenantKey] = modelSlashTenant();
    tenancy()->initialize($tenant);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => $tenantKey,
        'user_id' => $user->id,
        'title' => 'Alias thread',
    ]);

    $reply = app(CarinaModelSlashCommandService::class)->tryHandle('/model claude', $conversation);
    $conversation->refresh();

    expect($reply)->not->toBeNull()
        ->and($reply)->toContain('Switched to anthropic')
        ->and($conversation->model_override)->toBe('anthropic');

    tenancy()->end();
});

it('selectProvider honours conversation model_override', function (): void {
    $bundle = new AiRuntimeBundle([
        'anthropic' => [
            'api_key' => 'sk-ant',
            'base_url' => 'https://api.anthropic.com/v1',
            'model' => 'claude-test',
        ],
        'deepseek' => [
            'api_key' => 'sk-ds',
            'base_url' => 'https://api.deepseek.com/v1',
            'model' => 'deepseek-chat',
        ],
    ], ['anthropic', 'deepseek']);

    Config::set('ai.providers', [
        'anthropic' => ['api_key' => 'sk-ant', 'base_url' => 'https://api.anthropic.com/v1'],
        'deepseek' => ['api_key' => 'sk-ds', 'base_url' => 'https://api.deepseek.com/v1'],
    ]);

    $runtime = Mockery::mock(AiRuntimeResolutionService::class);
    $runtime->shouldReceive('resolve')->with('tenant-test')->andReturn($bundle);

    $router = new AiRouterService($runtime);
    $picked = $router->selectProvider('tenant-test', 'deepseek');

    expect($picked['provider'])->toBe('deepseek')
        ->and($picked['api_key'])->toBe('sk-ds');
});
