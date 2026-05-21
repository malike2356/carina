<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\URL;

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

    $hash = sha1(strtolower($user->email));
    $root = 'http://'.$host;
    URL::forceRootUrl($root);

    try {
        $url = URL::temporarySignedRoute(
            'tenant.verification.verify',
            now()->addHours(72),
            [
                'tenant_subdomain' => $tenant->slug,
                'id' => $user->id,
                'hash' => $hash,
            ],
        );
    } finally {
        URL::forceRootUrl(config('app.url'));
    }

    tenancy()->end();

    $path = parse_url($url, PHP_URL_PATH).'?'.parse_url($url, PHP_URL_QUERY);

    $this->get('http://'.$host.$path)
        ->assertRedirect(route('tenant.login', ['tenant_subdomain' => $tenant->slug], false))
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

    $root = 'http://'.$host;
    URL::forceRootUrl($root);

    try {
        $url = URL::temporarySignedRoute(
            'tenant.verification.verify',
            now()->addHours(72),
            [
                'tenant_subdomain' => $tenant->slug,
                'id' => $user->id,
                'hash' => 'invalidhash',
            ],
        );
    } finally {
        URL::forceRootUrl(config('app.url'));
    }

    $path = parse_url($url, PHP_URL_PATH).'?'.parse_url($url, PHP_URL_QUERY);

    $this->get('http://'.$host.$path)->assertForbidden();
});
