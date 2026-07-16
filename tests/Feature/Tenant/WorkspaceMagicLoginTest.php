<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Auth\WorkspaceMagicLoginService;
use App\Services\Tenancy\TenantCreationService;

it('signs in via magic link when app url differs from tenant host', function (): void {
    $email = 'magic-'.uniqid().'@example.test';

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Magic Login Test Ltd',
        'owner_name' => 'Test Owner',
        'owner_email' => $email,
        'plan' => 'investor',
        'send_welcome_email' => false,
    ]);

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    tenancy()->initialize($tenant);
    $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower($email)])->firstOrFail();
    $user->forceFill(['email_verified_at' => now()])->save();
    $magicUrl = app(WorkspaceMagicLoginService::class)->issueUrl($user);
    tenancy()->end();

    expect(parse_url($magicUrl, PHP_URL_HOST))->toBe($host);

    $this->get($magicUrl)->assertRedirect();

    $this->assertAuthenticated();
});
