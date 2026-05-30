<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('two-step wizard completes and persists workspace settings', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Onb depth '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@onb-depth.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    TenantSetting::query()->where('key', WorkspaceOnboardingService::SETTINGS_KEY)->delete();
    app(WorkspaceOnboardingService::class)->ensurePendingOnboardingRecordExists();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/onboarding/1', [
        'slug' => 'property_investor',
        'display_name' => 'Test WS',
        'name' => 'Test User',
        'phone' => '',
    ])->assertRedirect();

    $this->post($base.'/onboarding/2', [
        'timezone' => 'Europe/London',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(app(WorkspaceOnboardingService::class)->isLaunchFinished())->toBeTrue();
    expect(TenantSetting::query()->where('key', 'workspace_display_name')->value('value'))->toBe('Test WS');
    tenancy()->end();
});

it('strategy-adaptive getting started shows sourcing link for brr', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'BRR dash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@brr-dash.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    TenantSetting::query()->updateOrCreate(
        ['key' => 'workspace_primary_strategy'],
        ['value' => 'brr', 'group' => 'workspace']
    );
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/dashboard')
        ->assertOk()
        ->assertSee('Set up sourcing criteria');
});

it('strategy focus card visible after launch with btl', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'BTL focus '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@btl-focus.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    TenantSetting::query()->updateOrCreate(
        ['key' => 'workspace_primary_strategy'],
        ['value' => 'btl', 'group' => 'workspace']
    );
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/dashboard')
        ->assertOk()
        ->assertSee('Buy-to-Let');
});
