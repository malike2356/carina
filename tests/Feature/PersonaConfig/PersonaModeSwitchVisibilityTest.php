<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Persona\PersonaService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('shows workspace mode settings for new tenant admins without a 30 day wait', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mode Switch UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mode-switch.test',
        'plan' => 'operator',
        'persona' => 'mixed',
    ]);

    expect(app(PersonaService::class)->canShowModeSwitch($tenant))->toBeTrue();

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/settings/workspace/mode')
        ->assertOk()
        ->assertSee('Propreneur Ultimo')
        ->assertSee('Workspace mode');

    tenancy()->end();
});

it('lists workspace mode on settings overview for tenant admin', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mode Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mode-hub.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/settings')
        ->assertOk()
        ->assertSee('Workspace mode');

    tenancy()->end();
});
