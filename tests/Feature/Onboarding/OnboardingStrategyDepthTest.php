<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('step 2 saves experience level and capital range', function (): void {
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
    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/onboarding/1', ['display_name' => 'Test WS'])->assertRedirect();
    $this->post($base.'/onboarding/2', [
        'primary' => 'btl',
        'experience_level' => 'beginner',
        'capital_range' => 'under_50k',
        'target_postcodes_raw' => '',
    ])->assertRedirect($base.'/onboarding/3');

    $this->post($base.'/onboarding/3', ['name' => 'Test User', 'phone' => ''])->assertRedirect();
    $this->post($base.'/onboarding/4', ['timezone' => 'Europe/London'])->assertRedirect();

    $this->post($base.'/onboarding/launch', ['confirm' => '1'])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(TenantSetting::query()->where('key', 'workspace_experience_level')->value('value'))->toBe('beginner');
    expect(TenantSetting::query()->where('key', 'workspace_capital_range')->value('value'))->toBe('under_50k');
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
