<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Schema;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

it('provisions sourcing_criteria on new tenant databases', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Sourcing Schema Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sourcing-schema.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    expect(Schema::connection('tenant')->hasTable('sourcing_criteria'))->toBeTrue();
    tenancy()->end();
});
