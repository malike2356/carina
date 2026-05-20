<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('accepts tenant login post without server error when login throttle middleware is registered', function (): void {
    Http::preventStrayRequests();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Login throttle '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@login-throttle.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->post("http://{$host}/login", [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])
        ->assertRedirect()
        ->assertSessionHasErrors('email');

    $this->post("http://{$host}/login", [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect();
});
