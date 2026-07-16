<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\MentorshipProgramme;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->seed(SubscriptionPlanSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'mentoring_os')->update(['enabled' => true]);
});

function mentoringOsHubHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

it('lists and creates mentorship programmes via mentoring-os api', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentor API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentor-api.test',
        'plan' => 'starter',
    ]);
    $host = mentoringOsHubHost($tenant);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $admin = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $list = $this->getJson('http://'.$host.'/api/mentoring-os/mentorship-programmes');
    $list->assertOk();
    expect($list->json('data'))->toBeArray();

    $create = $this->postJson('http://'.$host.'/api/mentoring-os/mentorship-programmes', [
        'name' => 'API programme',
        'description' => 'From test',
        'is_active' => true,
    ]);
    $create->assertCreated();
    expect($create->json('data.name'))->toBe('API programme');

    $pid = (int) $create->json('data.id');
    $cohort = $this->postJson('http://'.$host.'/api/mentoring-os/mentorship-programmes/'.$pid.'/cohorts', [
        'name' => 'Cohort A',
        'is_active' => true,
    ]);
    $cohort->assertCreated();
    expect($cohort->json('data.name'))->toBe('Cohort A');
});

it('allows mentee to list programmes but not create them', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mentee API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mentee-api.test',
        'plan' => 'starter',
    ]);
    $host = mentoringOsHubHost($tenant);
    $tid = (string) $tenant->getTenantKey();

    tenancy()->initialize($tenant);
    MentorshipProgramme::query()->create([
        'tenant_id' => $tid,
        'name' => 'Read-only programme',
        'description' => null,
        'is_active' => true,
    ]);
    completeTenantWorkspaceOnboarding();
    $mentee = User::factory()->create([
        'email' => 'mentee-'.uniqid().'@mentee-api.test',
        'password' => Hash::make('secret'),
    ]);
    $mentee->assignRole('mentee');
    tenancy()->end();

    $this->actingAs($mentee, 'web');
    $this->getJson('http://'.$host.'/api/mentoring-os/mentorship-programmes')->assertOk();
    $this->postJson('http://'.$host.'/api/mentoring-os/mentorship-programmes', [
        'name' => 'Should fail',
    ])->assertForbidden();
});
