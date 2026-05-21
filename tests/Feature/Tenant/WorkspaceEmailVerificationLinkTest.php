<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Tenancy\TenantWorkspaceUrl;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('verifies workspace email via signed link and redirects to login', function (): void {
    $email = 'verify-link-'.uniqid().'@example.test';

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Verify Link Ltd',
        'owner_name' => 'Laud Test',
        'owner_email' => $email,
        'plan' => 'investor',
    ]);

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    tenancy()->initialize($tenant);
    $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower($email)])->firstOrFail();
    expect($user->email_verified_at)->toBeNull();
    tenancy()->end();

    $url = TenantWorkspaceUrl::temporarySignedRoute(
        $tenant,
        'tenant.verification.verify',
        now()->addHours(72),
        [
            'id' => $user->id,
            'hash' => sha1(strtolower($user->email)),
        ],
    );

    $path = parse_url($url, PHP_URL_PATH).'?'.(string) parse_url($url, PHP_URL_QUERY);

    tenantGet($host, $path)
        ->assertRedirect(tenantHttpUrl($host, '/login'))
        ->assertSessionHas('success');

    tenancy()->initialize($tenant);
    expect($user->fresh()->email_verified_at)->not->toBeNull();
    tenancy()->end();
});

it('rejects invalid verification hash with forbidden', function (): void {
    $email = 'verify-bad-'.uniqid().'@example.test';

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Verify Bad Ltd',
        'owner_name' => 'Laud Test',
        'owner_email' => $email,
        'plan' => 'investor',
    ]);

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    tenancy()->initialize($tenant);
    $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower($email)])->firstOrFail();
    tenancy()->end();

    $url = TenantWorkspaceUrl::temporarySignedRoute(
        $tenant,
        'tenant.verification.verify',
        now()->addHours(72),
        [
            'id' => $user->id,
            'hash' => 'invalidhash',
        ],
    );

    $path = parse_url($url, PHP_URL_PATH).'?'.(string) parse_url($url, PHP_URL_QUERY);

    tenantGet($host, $path)->assertForbidden();
});
