<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Spatie\Permission\PermissionRegistrar;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('registers and signs in an investor via session web portal', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'InvPortal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@invportal.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'investor_portal')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    User::query()->firstOrFail();

    Contact::factory()->investor()->create([
        'email' => 'portal-investor@example.test',
    ]);
    tenancy()->end();

    $this->post('http://'.$host.'/investor-portal/register', [
        'email' => 'portal-investor@example.test',
        'password' => 'password12345',
        'password_confirmation' => 'password12345',
    ])->assertRedirect(route('tenant.investor-portal.home'));

    $this->get('http://'.$host.'/investor-portal/')
        ->assertOk()
        ->assertSee('portal-investor@example.test', false);
});
