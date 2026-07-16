<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\ApiKey;
use App\Models\Tenant\TenantSecuritySetting;
use App\Models\Tenant\User;
use App\Services\Security\TenantApiKeyService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\URL;
use Illuminate\Testing\TestResponse;
use Spatie\Permission\Models\Role as TenantRole;

function trustCentreHost(Tenant $tenant): string
{
    return $tenant->domains->firstOrFail()->domain.'.propreneur.test';
}

function trustCentreDefaults(Tenant $tenant): void
{
    URL::defaults(['tenant_subdomain' => $tenant->domains->firstOrFail()->domain]);
}

function trustCentreGet(string $host, string $path): TestResponse
{
    return test()->withServerVariables(['HTTP_HOST' => $host])
        ->get('http://'.$host.'/'.ltrim($path, '/'));
}

function trustCentrePost(string $host, string $path, array $data = []): TestResponse
{
    return test()->withServerVariables(['HTTP_HOST' => $host])
        ->post('http://'.$host.'/'.ltrim($path, '/'), $data);
}

function trustCentrePut(string $host, string $path, array $data = []): TestResponse
{
    return test()->withServerVariables(['HTTP_HOST' => $host])
        ->put('http://'.$host.'/'.ltrim($path, '/'), $data);
}

it('returns trust centre index for authenticated tenant user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Trust '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@trust.test',
        'plan' => 'operator',
    ]);

    $host = trustCentreHost($tenant);
    trustCentreDefaults($tenant);
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    trustCentreGet($host, '/security')
        ->assertOk()
        ->assertSee('Trust Centre', false);
});

it('returns active sessions page for authenticated tenant user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Sessions '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sessions.test',
        'plan' => 'operator',
    ]);

    $host = trustCentreHost($tenant);
    trustCentreDefaults($tenant);
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    trustCentreGet($host, '/security/sessions')
        ->assertOk()
        ->assertSee('Active sessions', false);
});

it('forbids security settings for non admin tenant user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Settings Forbidden '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@settings-forbidden.test',
        'plan' => 'operator',
    ]);

    $host = trustCentreHost($tenant);
    trustCentreDefaults($tenant);

    tenancy()->initialize($tenant);
    TenantRole::findOrCreate('team_member', 'web');
    $staff = User::factory()->create(['email' => 'staff-'.uniqid().'@settings-forbidden.test']);
    $staff->syncRoles(['team_member']);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($staff, 'web');

    trustCentreGet($host, '/security/settings')->assertForbidden();
});

it('saves security settings for workspace admin on operator plan', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Settings Save '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@settings-save.test',
        'plan' => 'operator',
    ]);

    $host = trustCentreHost($tenant);
    trustCentreDefaults($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    trustCentrePut($host, '/security/settings', [
        'require_mfa' => '1',
        'notify_new_login' => '0',
        'notify_failed_logins' => '1',
        'allow_carina_write_tools' => '0',
        'ip_allowlist' => "10.0.0.0/8\n192.168.1.1",
    ])->assertRedirect(route('tenant.security.settings', [], false));

    tenancy()->initialize($tenant);
    $settings = TenantSecuritySetting::current();
    expect($settings->require_mfa)->toBeTrue()
        ->and($settings->notify_new_login)->toBeFalse()
        ->and($settings->allow_carina_write_tools)->toBeFalse()
        ->and($settings->ip_allowlist)->toBe(['10.0.0.0/8', '192.168.1.1']);
    tenancy()->end();
});

it('creates api key and shows full key once', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'API Key '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@api-key.test',
        'plan' => 'operator',
    ]);

    $host = trustCentreHost($tenant);
    trustCentreDefaults($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $response = trustCentrePost($host, '/security/api-keys', [
        'name' => 'CI integration',
        'abilities' => 'read',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('api_key_plain');

    $plain = (string) $response->getSession()->get('api_key_plain');
    expect($plain)->toStartWith('ppk_');

    trustCentreGet($host, '/security/api-keys')
        ->assertOk()
        ->assertSee($plain, false);

    trustCentreGet($host, '/security/api-keys')
        ->assertOk()
        ->assertDontSee($plain, false);
});

it('revokes api key', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'API Revoke '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@api-revoke.test',
        'plan' => 'operator',
    ]);

    $host = trustCentreHost($tenant);
    trustCentreDefaults($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    trustCentrePost($host, '/security/api-keys', [
        'name' => 'To revoke',
        'abilities' => 'read',
    ])->assertRedirect();

    trustCentreGet($host, '/security/api-keys')
        ->assertOk()
        ->assertSee('To revoke', false);

    tenancy()->initialize($tenant);
    $key = ApiKey::query()->where('name', 'To revoke')->firstOrFail();
    $keyId = (int) $key->id;
    expect($keyId)->toBeGreaterThan(0);
    expect(ApiKey::query()->active()->find($keyId))->not->toBeNull();

    app(TenantApiKeyService::class)->revoke($key, $admin);

    expect(ApiKey::query()->find($keyId)?->is_active)->toBeFalse();
    tenancy()->end();
});

it('does not list revoked api keys on index', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'API Index '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@api-index.test',
        'plan' => 'operator',
    ]);

    $host = trustCentreHost($tenant);
    trustCentreDefaults($tenant);

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    ApiKey::query()->create([
        'created_by' => $admin->id,
        'name' => 'Revoked key',
        'key_prefix' => 'ppk_dead',
        'key_hash' => hash('sha256', 'ppk_revoked'),
        'abilities' => 'read',
        'is_active' => false,
    ]);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    trustCentreGet($host, '/security/api-keys')
        ->assertOk()
        ->assertDontSee('Revoked key', false);
});
