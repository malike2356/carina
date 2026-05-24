<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\Tenant;
use App\Services\Persona\PersonaService;
use App\Services\Persona\SignupPersonaService;
use App\Services\Tenancy\TenantCreationService;

it('pulse persona workspace sees deal engine but not rooms or hmo compliance', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Pulse Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'pulse-'.uniqid().'@mode.test',
        'plan' => 'professional',
        'persona' => 'sourcer',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('sourcer')
        ->and($service->isBillingModuleVisible(BillingModule::DealEngine->value, $tenant))->toBeTrue()
        ->and($service->isBillingModuleVisible(BillingModule::Pipeline->value, $tenant))->toBeTrue()
        ->and($service->isFeatureVisible('rooms', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('hmo_compliance', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('tenancies', $tenant))->toBeFalse();
});

it('academy persona workspace sees mentoring but not deal sourcing', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Academy Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'academy-'.uniqid().'@mode.test',
        'plan' => 'mentor_network',
        'persona' => 'mentor',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('mentor')
        ->and($service->isBillingModuleVisible(BillingModule::MentoringOs->value, $tenant))->toBeTrue()
        ->and($service->isFeatureVisible('deal_sourcing', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('rooms', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('hmo_compliance', $tenant))->toBeFalse();
});

it('signup with persona query param creates workspace with correct persona', function (): void {
    $slug = 'let-'.strtolower(substr(uniqid(), -6));
    $email = "owner-{$slug}@signup-persona.test";

    $response = $this->withSession([])
        ->get(route('central.register', ['persona' => 'btl']));

    $response->assertOk();

    expect(session(SignupPersonaService::SESSION_KEY))->toBe('btl');

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Let Signup Co',
        'owner_name' => 'Owner',
        'owner_email' => $email,
        'plan' => 'professional',
        'persona' => 'btl',
        'send_welcome_email' => false,
    ]);

    $fresh = Tenant::query()->findOrFail($tenant->id);

    expect($fresh->persona)->toBe('btl');
});

it('normalizes invalid signup persona to mixed', function (): void {
    expect(app(SignupPersonaService::class)->normalize('invalid_mode'))->toBeNull()
        ->and(app(SignupPersonaService::class)->resolveFromData(['persona' => 'nope']))->toBe('mixed')
        ->and(app(SignupPersonaService::class)->resolveFromData([]))->toBe('mixed');
});
