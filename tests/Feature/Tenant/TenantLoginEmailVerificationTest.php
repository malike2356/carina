<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('blocks tenant login until email is verified', function (): void {
    $email = 'unverified-'.uniqid().'@example.test';

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Verify Login Test Ltd',
        'owner_name' => 'Test Owner',
        'owner_email' => $email,
        'plan' => 'investor',
    ]);

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    tenancy()->initialize($tenant);
    $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower($email)])->firstOrFail();
    $user->forceFill([
        'password' => Hash::make('password123'),
        'email_verified_at' => null,
    ])->save();
    tenancy()->end();

    $this->post("http://{$host}/login", [
        'email' => $email,
        'password' => 'password123',
    ])
        ->assertRedirect()
        ->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('allows tenant login after email is verified', function (): void {
    $email = 'verified-'.uniqid().'@example.test';

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Verified Login Test Ltd',
        'owner_name' => 'Test Owner',
        'owner_email' => $email,
        'plan' => 'investor',
    ]);

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    tenancy()->initialize($tenant);
    $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower($email)])->firstOrFail();
    $user->forceFill([
        'password' => Hash::make('password123'),
        'email_verified_at' => now(),
    ])->save();
    tenancy()->end();

    $this->post("http://{$host}/login", [
        'email' => $email,
        'password' => 'password123',
    ])->assertRedirect();

    $this->assertAuthenticated();
});
