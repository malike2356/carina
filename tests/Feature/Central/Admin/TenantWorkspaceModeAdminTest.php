<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;
use App\Services\Persona\PersonaService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('shows workspace mode on tenant edit', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mode Admin '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mode-admin.test',
        'plan' => 'operator',
        'persona' => 'hmo',
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.saas-tenancy.edit', $tenant))
        ->assertOk()
        ->assertSee('Workspace mode')
        ->assertSee('Nexio');
});

it('updates workspace mode from platform admin tenant edit', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant([
        'company_name' => 'Mode Switch '.uniqid(),
        'owner_email' => 'owner-'.uniqid().'@mode-switch.test',
        'plan' => 'starter',
        'persona' => 'hmo',
    ]);

    $this->actingAs($admin, 'platform')
        ->put(route('admin.saas-tenancy.update', $tenant), [
            'company_name' => $tenant->company_name,
            'owner_name' => $tenant->owner_name,
            'owner_email' => $tenant->owner_email,
            'plan' => $tenant->plan,
            'persona' => 'mixed',
            'is_active' => true,
        ])
        ->assertRedirect(route('admin.saas-tenancy.edit', $tenant))
        ->assertSessionHas('success');

    expect(app(PersonaService::class)->resolveSlug($tenant->fresh()))->toBe('mixed');
});
