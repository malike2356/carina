<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Schema;

it('defaults existing tenants to mixed persona after migration', function (): void {
    expect(Schema::connection('central')->hasColumn('tenants', 'persona'))->toBeTrue();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Persona Migrate '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@persona-migrate.test',
        'plan' => 'starter',
    ]);

    $fresh = Tenant::query()->findOrFail($tenant->id);

    expect($fresh->persona)->toBe('mixed');
});
