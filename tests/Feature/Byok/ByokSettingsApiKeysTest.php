<?php

declare(strict_types=1);

use App\Models\Central\TenantAiSetting;
use App\Models\Tenant\IntegrationConfig;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use App\Services\UserManagement\RolePermissionService;
use App\Support\Integrations\IntegrationProvider;
use App\Support\TestingCentralCatalog;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('persists a tenant AI key and shows masked preview on settings page', function (): void {
    Http::fake([
        'https://api.openai.com/v1/models' => Http::response(['data' => []], 200),
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'BYOK Settings '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'byok-settings-'.uniqid().'@test.example',
        'plan' => 'starter',
    ]);

    $host = actingAsTenant($tenant);

    $save = $this->withServerVariables(['HTTP_HOST' => $host])
        ->postJson(tenantHttpUrl($host, '/settings/api-keys/ai/openai'), [
            'api_key' => 'sk-openai-byok-test-key',
        ]);

    $save->assertOk()
        ->assertJsonPath('status', 'valid')
        ->assertJsonPath('masked_key', 'sk-****-key');

    TestingCentralCatalog::realignCentralConnectionForTesting();

    $setting = TenantAiSetting::query()->where('tenant_id', $tenant->id)->first();
    expect($setting)->not->toBeNull()
        ->and($setting->provider_overrides['openai']['api_key'] ?? null)->toBe('sk-openai-byok-test-key')
        ->and($setting->provider_key_statuses['openai']['status'] ?? null)->toBe('valid');

    $page = tenantGet($host, '/settings/api-keys');
    $page->assertOk()
        ->assertSee('sk-****-key', false)
        ->assertSee('valid', false);
});

it('persists a PropertyData key for the workspace', function (): void {
    Http::fake([
        'https://api.propertydata.co.uk/sourced-properties*' => Http::response(['status' => 'ok'], 200),
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'PD Settings '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pd-settings-'.uniqid().'@test.example',
        'plan' => 'starter',
    ]);

    $host = actingAsTenant($tenant);

    $save = $this->withServerVariables(['HTTP_HOST' => $host])
        ->postJson(tenantHttpUrl($host, '/settings/api-keys/propertydata'), [
            'api_key' => 'pd-secret-test-key-1234',
        ]);

    $save->assertOk()
        ->assertJsonPath('masked_key', 'pd-****1234');

    tenancy()->initialize($tenant);

    $cfg = IntegrationConfig::forCurrentTenant(IntegrationProvider::PropertyData->value);
    expect($cfg)->not->toBeNull()
        ->and($cfg->credentials_encrypted['api_key'] ?? null)->toBe('pd-secret-test-key-1234')
        ->and($cfg->key_status)->toBe('valid');

    tenancy()->end();
});

it('requires workspace admin for api key routes', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'BYOK Member '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'byok-member-'.uniqid().'@test.example',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode([
            'completed_at' => now()->toIso8601String(),
            'onboarding_version' => 2,
            'max_unlocked_step' => WorkspaceOnboardingService::TOTAL_STEPS,
            'workspace' => ['display_name' => 'BYOK Member Co'],
            'strategy' => ['primary' => 'btl', 'target_postcodes_raw' => ''],
            'profile' => ['name' => 'Member', 'phone' => null],
            'preferences' => ['timezone' => 'Europe/London'],
            'preferences_skipped' => false,
        ]), 'group' => 'onboarding']
    );
    $member = User::query()->create([
        'name' => 'Member',
        'email' => 'member-'.uniqid().'@test.example',
        'password' => bcrypt('password'),
        'is_active' => true,
    ]);
    app(RolePermissionService::class)->assignRole($member, 'team_member');
    tenancy()->end();

    $this->actingAs($member, 'web')
        ->withServerVariables(['HTTP_HOST' => $host])
        ->postJson(tenantHttpUrl($host, '/settings/api-keys/ai/openai'), ['api_key' => 'sk-test'])
        ->assertForbidden();
});
