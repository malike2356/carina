<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\TenantSecuritySetting;
use App\Models\Tenant\User;
use App\Services\Auth\MfaService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\URL;
use Illuminate\Testing\TestResponse;
use PragmaRX\Google2FA\Google2FA;

function mfaTenantHost(Tenant $tenant): string
{
    return $tenant->domains->firstOrFail()->domain.'.propreneur.test';
}

function mfaTenantDefaults(Tenant $tenant): void
{
    URL::defaults(['tenant_subdomain' => $tenant->domains->firstOrFail()->domain]);
}

function mfaPost(string $host, string $path, array $data = []): TestResponse
{
    return test()->withServerVariables(['HTTP_HOST' => $host])
        ->post('http://'.$host.'/'.ltrim($path, '/'), $data);
}

function mfaGet(string $host, string $path): TestResponse
{
    return test()->withServerVariables(['HTTP_HOST' => $host])
        ->get('http://'.$host.'/'.ltrim($path, '/'));
}

it('allows user without mfa to access tenant dashboard after login', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'No MFA '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@no-mfa.test',
        'plan' => 'operator',
    ]);

    $host = mfaTenantHost($tenant);
    mfaTenantDefaults($tenant);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    test()->actingAs($user, 'web')->withSession(['mfa_verified' => true]);

    mfaGet($host, '/')
        ->assertOk();
});

it('redirects mfa enabled user to challenge after login', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'MFA Login '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mfa-login.test',
        'plan' => 'operator',
    ]);

    $host = mfaTenantHost($tenant);
    mfaTenantDefaults($tenant);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $secret = app(MfaService::class)->generateSecret();
    app(MfaService::class)->enable($user, $secret);
    $user->update(['password' => bcrypt('password')]);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    mfaPost($host, '/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('tenant.mfa.challenge', [], false));
});

it('sets mfa verified session flag after valid totp at challenge', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'MFA Verify '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mfa-verify.test',
        'plan' => 'operator',
    ]);

    $host = mfaTenantHost($tenant);
    mfaTenantDefaults($tenant);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $secret = app(MfaService::class)->generateSecret();
    app(MfaService::class)->enable($user, $secret);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    test()->actingAs($user, 'web');

    $code = (new Google2FA)->getCurrentOtp($secret);

    $response = mfaPost($host, '/security/mfa/verify', ['code' => $code]);
    $response->assertRedirect()
        ->assertSessionHas('mfa_verified', true);
});

it('rejects invalid totp at challenge', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'MFA Bad '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mfa-bad.test',
        'plan' => 'operator',
    ]);

    $host = mfaTenantHost($tenant);
    mfaTenantDefaults($tenant);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $secret = app(MfaService::class)->generateSecret();
    app(MfaService::class)->enable($user, $secret);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    test()->actingAs($user, 'web');

    mfaPost($host, '/security/mfa/verify', ['code' => '000000'])
        ->assertSessionHasErrors('code');

    expect(session('mfa_verified'))->not->toBeTrue();
});

it('accepts a recovery code at challenge', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'MFA Recovery '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mfa-recovery.test',
        'plan' => 'operator',
    ]);

    $host = mfaTenantHost($tenant);
    mfaTenantDefaults($tenant);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $secret = app(MfaService::class)->generateSecret();
    $codes = app(MfaService::class)->enable($user, $secret);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    test()->actingAs($user, 'web');

    mfaPost($host, '/security/mfa/verify', ['code' => $codes[0]])
        ->assertRedirect()
        ->assertSessionHas('mfa_verified', true);
});

it('cannot reuse a consumed recovery code', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'MFA Reuse '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mfa-reuse.test',
        'plan' => 'operator',
    ]);

    $host = mfaTenantHost($tenant);
    mfaTenantDefaults($tenant);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $secret = app(MfaService::class)->generateSecret();
    $codes = app(MfaService::class)->enable($user, $secret);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    test()->actingAs($user, 'web');

    mfaPost($host, '/security/mfa/verify', ['code' => $codes[0]])->assertRedirect();

    test()->actingAs($user, 'web');
    session()->forget('mfa_verified');

    mfaPost($host, '/security/mfa/verify', ['code' => $codes[0]])
        ->assertSessionHasErrors('code');
});

it('stores encrypted secret and eight recovery codes on enable', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'MFA Enable '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mfa-enable.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $secret = app(MfaService::class)->generateSecret();
    $codes = app(MfaService::class)->enable($user, $secret);
    $user->refresh();

    expect($user->mfa_enabled)->toBeTrue()
        ->and($user->mfa_secret)->not->toBeNull()
        ->and($user->mfa_secret)->not->toBe($secret)
        ->and(count($codes))->toBe(8)
        ->and(count($user->mfa_recovery_codes ?? []))->toBe(8)
        ->and(app(MfaService::class)->getSecret($user))->toBe($secret);

    tenancy()->end();
});

it('redirects to mfa setup when workspace enforces mfa and user has not configured it', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'MFA Enforced '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mfa-enforced.test',
        'plan' => 'operator',
    ]);

    $host = mfaTenantHost($tenant);
    mfaTenantDefaults($tenant);

    tenancy()->initialize($tenant);
    TenantSecuritySetting::current()->update(['require_mfa' => true]);
    $user = User::query()->firstOrFail();
    $user->update(['mfa_enabled' => false, 'mfa_secret' => null]);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    test()->actingAs($user, 'web')->withSession(['mfa_verified' => false]);

    mfaGet($host, '/deals')
        ->assertRedirect(route('tenant.mfa.setup', [], false));
});
