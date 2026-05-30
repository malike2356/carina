<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
});

it('marks workspace onboarding complete from saas tenancy edit', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Complete Onboard Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@complete-onboard.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $tenant->update(['workspace_onboarding_completed_at' => null]);

    tenancy()->initialize($tenant);
    app(WorkspaceOnboardingService::class)->ensurePendingOnboardingRecordExists();
    tenancy()->end();

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.saas-tenancy.complete-onboarding', $tenant))
        ->assertRedirect()
        ->assertSessionHas('success');

    $tenant->refresh();
    expect($tenant->workspace_onboarding_completed_at)->not->toBeNull();

    tenancy()->initialize($tenant);
    expect(app(WorkspaceOnboardingService::class)->isCompleted())->toBeTrue();
    tenancy()->end();
});

it('forbids complete onboarding without manage permission', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'No Perm Complete Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@no-perm-complete.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $viewer = PlatformUser::factory()->create(['role' => 'support']);

    $this->actingAs($viewer, 'platform')
        ->post(route('admin.saas-tenancy.complete-onboarding', $tenant))
        ->assertForbidden();
});

it('supports deferred completion from platform admin', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Deferred Onboard Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@deferred-onboard.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $tenant->update(['workspace_onboarding_completed_at' => null]);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.saas-tenancy.complete-onboarding', $tenant), ['deferred' => '1'])
        ->assertRedirect()
        ->assertSessionHas('success');

    tenancy()->initialize($tenant);
    $svc = app(WorkspaceOnboardingService::class);
    expect($svc->isCompleted())->toBeTrue();
    expect($svc->isSetupDeferred())->toBeTrue();
    tenancy()->end();
});
