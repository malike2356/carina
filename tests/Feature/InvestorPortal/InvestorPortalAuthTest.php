<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('registers an investor portal user when a matching investor contact exists and returns me on bearer token', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Portal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@portal-inv.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $investor = Contact::factory()->investor()->create([
        'email' => 'inv-'.uniqid().'@portal-inv.test',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $base = 'http://'.$host;

    $this->postJson($base.'/api/investor-portal/register', [
        'email' => $investor->email,
        'password' => 'secret-long-pass',
        'password_confirmation' => 'secret-long-pass',
    ])
        ->assertCreated()
        ->assertJsonStructure(['token', 'token_type', 'user' => ['id', 'email', 'contact_id', 'contact']]);

    $token = $this->postJson($base.'/api/investor-portal/login', [
        'email' => $investor->email,
        'password' => 'secret-long-pass',
    ])->assertOk()->json('token');

    $this->withToken($token)->getJson($base.'/api/investor-portal/me')
        ->assertOk()
        ->assertJsonPath('user.email', $investor->email)
        ->assertJsonPath('user.contact.id', $investor->id);
});

it('rejects portal registration when no investor contact matches the email', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Portal X '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@portal-inv.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->postJson('http://'.$host.'/api/investor-portal/register', [
        'email' => 'nobody@example.test',
        'password' => 'secret-long-pass',
        'password_confirmation' => 'secret-long-pass',
    ])->assertUnprocessable();
});
