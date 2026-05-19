<?php

declare(strict_types=1);

use App\Models\Tenant\BusinessPageSettings;
use App\Services\BusinessPage\BusinessPageService;
use App\Services\Tenancy\TenantCreationService;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('publishes and unpublishes the business page', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'BP Service '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@bpservice.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $service = app(BusinessPageService::class);

    expect($service->isPubliclyVisible())->toBeFalse();

    $service->publish();

    expect($service->isPubliclyVisible())->toBeTrue()
        ->and(BusinessPageSettings::current()?->published_at)->not->toBeNull();

    $service->unpublish();

    expect($service->isPubliclyVisible())->toBeFalse();

    tenancy()->end();
});
