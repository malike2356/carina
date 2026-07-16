<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

it('renders tenant reporting hub and saved reports when reporting is enabled', function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::on('central')->where('key', 'reporting_intelligence')->update(['enabled' => true]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Reporting UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rpt-ui.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/reporting')->assertOk()->assertSee('Analytics hub', false);
    $this->get('http://'.$host.'/reporting/reports')->assertOk()->assertSee('Saved reports', false);
});
