<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Services\Persona\PersonaService;
use App\Services\Tenancy\TenantCreationService;

it('hides pipeline module for hmo persona', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Persona HMO '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@persona-hmo.test',
        'plan' => 'professional',
    ]);

    $tenant->persona = 'hmo';
    $tenant->save();

    $service = app(PersonaService::class);

    expect($service->isBillingModuleVisible(BillingModule::Pipeline->value, $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('strategy_finder', $tenant))->toBeFalse()
        ->and($service->isBillingModuleVisible(BillingModule::MentoringOs->value, $tenant))->toBeFalse();
});

it('shows all mapped billing modules for mixed persona', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Persona Mixed '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@persona-mixed.test',
        'plan' => 'professional',
    ]);

    $tenant->persona = 'mixed';
    $tenant->save();

    $service = app(PersonaService::class);

    $cfg = $service->config($tenant);

    expect($service->isBillingModuleVisible(BillingModule::Pipeline->value, $tenant))->toBeTrue()
        ->and($service->isFeatureVisible('strategy_finder', $tenant))->toBeTrue()
        ->and($service->isBillingModuleVisible(BillingModule::DealEngine->value, $tenant))->toBeTrue()
        ->and($cfg['name'])->toBe('Propreneur Ultimo')
        ->and($cfg['description'])->toBe('Full platform')
        ->and($service->allowedDashboardWidgetTypes($tenant))->toBe([]);
});
