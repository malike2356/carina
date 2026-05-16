<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

it('renders portfolio model page with query params', function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::on('central')->where('key', 'reporting_intelligence')->update(['enabled' => true]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Portfolio model '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pf-model.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    Property::query()->create([
        'address_line1' => '10 Model Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'status' => 'lead',
        'current_value' => 200_000,
        'monthly_cashflow' => 400,
        'created_by' => $user->id,
    ]);
    Property::query()->create([
        'address_line1' => '20 Model Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 2BB',
        'property_type' => 'flat',
        'status' => 'lead',
        'current_value' => 150_000,
        'monthly_cashflow' => 250,
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/reporting/portfolio-model')
        ->assertOk()
        ->assertSee('Portfolio projection model', false);

    $this->get('http://'.$host.'/reporting/portfolio-model?appreciation=5&rent_growth=3')
        ->assertOk();
});
