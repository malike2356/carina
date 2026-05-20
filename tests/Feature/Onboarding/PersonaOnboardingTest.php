<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\UserFeatureProfileService;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Schema;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function personaOnboardingHost(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Persona '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@persona.test',
        'plan' => 'mentor_network',
    ]);

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    TenantSetting::query()->where('key', WorkspaceOnboardingService::SETTINGS_KEY)->delete();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('persona step stores slug in onboarding state', function (): void {
    [$tenant, $host, $user] = personaOnboardingHost();

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/onboarding/1', ['slug' => 'portfolio_manager'])
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $state = app(WorkspaceOnboardingService::class)->getState();
    expect($state['persona']['slug'])->toBe('portfolio_manager');
    tenancy()->end();
});

it('sourcer_packager launch redirects to dashboard without error', function (): void {
    [$tenant, $host, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    $service = app(WorkspaceOnboardingService::class);
    $state = $service->getState();
    $state['persona'] = ['slug' => 'sourcer_packager'];
    $state['max_unlocked_step'] = WorkspaceOnboardingService::TOTAL_STEPS;
    $state['strategy'] = [
        'target_area' => 'Portsmouth, Hampshire',
        'deal_types' => ['bmv', 'r2r', 'hmo'],
        'compliance_status' => 'aml_progress',
    ];
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode($state), 'group' => 'onboarding']
    );
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/onboarding/launch', ['confirm' => '1'])
        ->assertRedirect();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/')
        ->assertOk();

    tenancy()->initialize($tenant);
    $user->refresh();
    expect($user->feature_preferences['persona'] ?? null)->toBe('sourcer_packager');
    expect($user->feature_preferences['active_modules'] ?? [])->toContain(BillingModule::Pipeline->value);
    tenancy()->end();
});

it('dashboard loads when pipeline tables are missing after sourcer launch', function (): void {
    [$tenant, $host, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    $service = app(WorkspaceOnboardingService::class);
    $state = $service->getState();
    $state['persona'] = ['slug' => 'sourcer_packager'];
    $state['max_unlocked_step'] = WorkspaceOnboardingService::TOTAL_STEPS;
    $state['completed_at'] = now()->toIso8601String();
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode($state), 'group' => 'onboarding']
    );
    app(\App\Services\Onboarding\UserFeatureProfileService::class)->setPersona($user, 'sourcer_packager');

    if (Schema::connection('tenant')->hasTable('pipelines')) {
        Schema::connection('tenant')->rename('pipelines', '_pipelines_hidden_for_test');
    }
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/')
        ->assertOk();
});

it('launch calls setPersona on the user', function (): void {
    [$tenant, $host, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    $service = app(WorkspaceOnboardingService::class);
    $state = $service->getState();
    $state['persona'] = ['slug' => 'mentor_educator'];
    $state['max_unlocked_step'] = WorkspaceOnboardingService::TOTAL_STEPS;
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode($state), 'group' => 'onboarding']
    );
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/onboarding/launch', ['confirm' => '1'])
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $user->refresh();
    expect($user->feature_preferences['persona'] ?? null)->toBe('mentor_educator');
    expect($user->feature_preferences['active_modules'] ?? [])->toContain(BillingModule::MentoringOs->value);
    tenancy()->end();
});

it('legacy user with null feature_preferences sees all modules as active', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    $user->feature_preferences = null;
    $user->save();

    $profile = app(UserFeatureProfileService::class);
    expect($profile->isActive($user, BillingModule::AssetManager))->toBeTrue();
    expect($profile->isActive($user, BillingModule::DealEngine))->toBeTrue();
    tenancy()->end();
});

it('portfolio_manager persona activates asset_manager by default', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    app(UserFeatureProfileService::class)->setPersona($user, 'portfolio_manager');
    $user->refresh();

    expect($user->feature_preferences['active_modules'])->toContain(BillingModule::AssetManager->value);
    tenancy()->end();
});

it('property_investor persona does not activate asset_manager by default', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    app(UserFeatureProfileService::class)->setPersona($user, 'property_investor');
    $user->refresh();

    expect($user->feature_preferences['active_modules'])->not->toContain(BillingModule::AssetManager->value);
    tenancy()->end();
});

it('mentor_educator persona activates mentoring_os by default', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    app(UserFeatureProfileService::class)->setPersona($user, 'mentor_educator');
    $user->refresh();

    expect($user->feature_preferences['active_modules'])->toContain(BillingModule::MentoringOs->value);
    tenancy()->end();
});

it('sourcer_packager persona does not activate accounting by default', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    app(UserFeatureProfileService::class)->setPersona($user, 'sourcer_packager');
    $user->refresh();

    expect($user->feature_preferences['active_modules'])->not->toContain(BillingModule::Accounting->value);
    tenancy()->end();
});

it('deactivating carina_ai is silently ignored', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    $service = app(UserFeatureProfileService::class);
    $service->setPersona($user, 'property_investor');
    $user->refresh();
    $service->deactivateModule($user, BillingModule::CarinaAi);
    $user->refresh();

    expect($user->feature_preferences['active_modules'])->toContain(BillingModule::CarinaAi->value);
    tenancy()->end();
});

it('manually activating a module adds it to manually_activated list', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    $service = app(UserFeatureProfileService::class);
    $service->setPersona($user, 'property_investor');
    $user->refresh();
    $service->activateModule($user, BillingModule::AssetManager);
    $user->refresh();

    expect($user->feature_preferences['manually_activated'])->toContain(BillingModule::AssetManager->value);
    tenancy()->end();
});

it('resetting to persona defaults clears manual overrides', function (): void {
    [$tenant,, $user] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    $service = app(UserFeatureProfileService::class);
    $service->setPersona($user, 'property_investor');
    $user->refresh();
    $service->activateModule($user, BillingModule::AssetManager);
    $user->refresh();
    $service->resetToPersonaDefaults($user);
    $user->refresh();

    expect($user->feature_preferences['active_modules'])->not->toContain(BillingModule::AssetManager->value);
    expect($user->feature_preferences['manually_activated'])->toBe([]);
    tenancy()->end();
});

it('v2 onboarding state migrates to v3 schema on first load', function (): void {
    [$tenant,,] = personaOnboardingHost();

    tenancy()->initialize($tenant);
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode([
            'completed_at' => null,
            'onboarding_version' => 2,
            'max_unlocked_step' => 5,
            'workspace' => ['display_name' => 'X'],
            'strategy' => ['primary' => 'btl', 'target_postcodes_raw' => '', 'experience_level' => '', 'capital_range' => '', 'secondary' => []],
            'profile' => ['name' => 'Y', 'phone' => null],
            'preferences' => ['timezone' => 'Europe/London'],
        ]), 'group' => 'onboarding']
    );

    $state = app(WorkspaceOnboardingService::class)->getState();
    expect($state['onboarding_version'])->toBe(3);
    expect($state)->toHaveKey('persona');
    expect($state['persona']['slug'])->toBe('');
    tenancy()->end();
});
