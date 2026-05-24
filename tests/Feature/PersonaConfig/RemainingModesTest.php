<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Services\Persona\PersonaService;
use App\Services\Persona\SignupPersonaService;
use App\Services\Tenancy\TenantCreationService;

it('lodge persona hides hmo modules and tags sa knowledge', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Lodge Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'lodge-'.uniqid().'@mode.test',
        'plan' => 'professional',
        'persona' => 'lodge',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('lodge')
        ->and($service->isFeatureVisible('rooms', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('hmo_compliance', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('mentoring', $tenant))->toBeFalse()
        ->and($service->config($tenant)['carina_persona'])->toBe('sa_operator')
        ->and($service->config($tenant)['knowledge_tags'])->toContain('sa');
});

it('steward persona focuses on block management modules', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Steward Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'steward-'.uniqid().'@mode.test',
        'plan' => 'professional',
        'persona' => 'steward',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('steward')
        ->and($service->isFeatureVisible('rooms', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('deal_sourcing', $tenant))->toBeFalse()
        ->and($service->isBillingModuleVisible(BillingModule::MultiProperty->value, $tenant))->toBeTrue();
});

it('agency persona keeps properties and hides sourcer tools', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Agency Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'agency-'.uniqid().'@mode.test',
        'plan' => 'professional',
        'persona' => 'agency',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('agency')
        ->and($service->isFeatureVisible('deal_sourcing', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('hmo_compliance', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('tenancies', $tenant))->toBeTrue();
});

it('forge persona keeps deal engine and hides tenancies nav', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Forge Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'forge-'.uniqid().'@mode.test',
        'plan' => 'professional',
        'persona' => 'forge',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('forge')
        ->and($service->isFeatureVisible('tenancies', $tenant))->toBeFalse()
        ->and($service->isBillingModuleVisible(BillingModule::DealEngine->value, $tenant))->toBeTrue();
});

it('bridge persona keeps r2r calculators path via deal engine', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Bridge Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'bridge-'.uniqid().'@mode.test',
        'plan' => 'professional',
        'persona' => 'bridge',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('bridge')
        ->and($service->isFeatureVisible('deal_sourcing', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('rooms', $tenant))->toBeFalse()
        ->and($service->isBillingModuleVisible(BillingModule::DealEngine->value, $tenant))->toBeTrue();
});

it('hall persona keeps rooms and hides deal sourcing', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Hall Mode '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'hall-'.uniqid().'@mode.test',
        'plan' => 'professional',
        'persona' => 'hall',
    ]);

    $service = app(PersonaService::class);

    expect($service->resolveSlug($tenant))->toBe('hall')
        ->and($service->isFeatureVisible('rooms', $tenant))->toBeTrue()
        ->and($service->isFeatureVisible('hmo_compliance', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('deal_sourcing', $tenant))->toBeFalse();
});

it('maps phase 7 landing pages to persona slugs', function (): void {
    expect(SignupPersonaService::LANDING_PERSONA_MAP['lodge.html'])->toBe('lodge')
        ->and(SignupPersonaService::LANDING_PERSONA_MAP['steward.html'])->toBe('steward')
        ->and(SignupPersonaService::LANDING_PERSONA_MAP['agency.html'])->toBe('agency')
        ->and(SignupPersonaService::LANDING_PERSONA_MAP['forge.html'])->toBe('forge')
        ->and(SignupPersonaService::LANDING_PERSONA_MAP['bridge.html'])->toBe('bridge')
        ->and(SignupPersonaService::LANDING_PERSONA_MAP['hall.html'])->toBe('hall');
});
