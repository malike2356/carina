<?php

declare(strict_types=1);

use App\Models\Central\Tenant as CentralTenant;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function onboardingTenantHost(): array
{
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Onboard '.uniqid(),
        'owner_name' => 'Owner Person',
        'owner_email' => 'owner-'.uniqid().'@onboarding.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('treats a missing workspace_onboarding row as incomplete and sends the dashboard to onboarding', function () {
    [$tenant, $host, $user] = onboardingTenantHost();

    tenancy()->initialize($tenant);
    TenantSetting::query()->where('key', WorkspaceOnboardingService::SETTINGS_KEY)->delete();
    expect(app(WorkspaceOnboardingService::class)->isCompleted())->toBeFalse();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/')
        ->assertRedirect()
        ->assertRedirectContains('/onboarding/');
});

it('shows a sign-in prompt for guests on /onboarding', function () {
    [, $host] = onboardingTenantHost();

    $this->get('http://'.$host.'/onboarding')
        ->assertOk()
        ->assertSee('Sign in to continue')
        ->assertSee('Workspace setup');
});

it('redirects GET /onboarding/ to the current wizard step', function () {
    [$tenant, $host, $user] = onboardingTenantHost();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/onboarding/')
        ->assertRedirect()
        ->assertRedirectContains('/onboarding/1');

    tenancy()->initialize($tenant);
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode([
            'completed_at' => null,
            'max_unlocked_step' => 3,
            'workspace' => ['display_name' => 'X'],
            'profile' => ['name' => 'Y', 'phone' => null],
            'preferences' => ['timezone' => 'Europe/London'],
            'preferences_skipped' => false,
        ]), 'group' => 'onboarding']
    );
    tenancy()->end();

    $this->get('http://'.$host.'/onboarding')
        ->assertRedirect()
        ->assertRedirectContains('/onboarding/3');
});

it('redirects the dashboard to onboarding until the wizard is completed', function () {
    [$tenant, $host, $user] = onboardingTenantHost();

    $this->actingAs($user, 'web');

    $r = $this->get('http://'.$host.'/');
    $r->assertRedirect();
    expect($r->headers->get('Location'))->toContain('/onboarding/1');

    tenancy()->initialize($tenant);
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode([
            'completed_at' => now()->toIso8601String(),
            'max_unlocked_step' => 4,
            'workspace' => ['display_name' => 'X'],
            'profile' => ['name' => 'Y', 'phone' => null],
            'preferences' => ['timezone' => 'Europe/London'],
            'preferences_skipped' => false,
        ]), 'group' => 'onboarding']
    );
    tenancy()->end();

    $this->get('http://'.$host.'/')->assertOk();
});

it('advances steps sequentially and completes onboarding', function () {
    [$tenant, $host, $user] = onboardingTenantHost();

    $this->actingAs($user, 'web');

    $r4 = $this->get('http://'.$host.'/onboarding/4');
    $r4->assertRedirect();
    expect($r4->headers->get('Location'))->toContain('/onboarding/1');

    $r1 = $this->post('http://'.$host.'/onboarding/1', [
        'display_name' => 'Acme Lets Ltd',
    ]);
    $r1->assertRedirect();
    expect($r1->headers->get('Location'))->toContain('/onboarding/2');

    $r2 = $this->post('http://'.$host.'/onboarding/2', [
        'name' => 'Owner Person',
        'phone' => '',
    ]);
    $r2->assertRedirect();
    expect($r2->headers->get('Location'))->toContain('/onboarding/3');

    $r3 = $this->post('http://'.$host.'/onboarding/3', [
        'timezone' => 'Europe/London',
    ]);
    $r3->assertRedirect();
    expect($r3->headers->get('Location'))->toContain('/onboarding/4');

    $rLaunch = $this->post('http://'.$host.'/onboarding/launch', [
        'confirm' => '1',
    ]);
    $rLaunch->assertRedirect();
    expect($rLaunch->headers->get('Location'))->not->toContain('/onboarding');

    tenancy()->initialize($tenant);
    expect(app(WorkspaceOnboardingService::class)->isCompleted())->toBeTrue();
    expect($user->fresh()->name)->toBe('Owner Person');
    tenancy()->end();

    expect(CentralTenant::query()->find($tenant->id)?->workspace_onboarding_completed_at)->not->toBeNull();

    $this->get('http://'.$host.'/')->assertOk();
});

it('can skip preferences with defaults and complete onboarding', function () {
    [$tenant, $host, $user] = onboardingTenantHost();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/onboarding/1', ['display_name' => 'Skip Prefs Ltd']);
    $this->post('http://'.$host.'/onboarding/2', ['name' => 'Taylor Example', 'phone' => '']);

    $skip = $this->post('http://'.$host.'/onboarding/preferences/skip');
    $skip->assertRedirect();
    expect($skip->headers->get('Location'))->toContain('/onboarding/4');

    $this->post('http://'.$host.'/onboarding/launch', ['confirm' => '1']);

    tenancy()->initialize($tenant);
    $state = app(WorkspaceOnboardingService::class)->getState();
    expect($state['preferences_skipped'])->toBeTrue();
    expect($state['preferences']['timezone'])->toBe('Europe/London');
    tenancy()->end();

    expect(CentralTenant::query()->find($tenant->id)?->workspace_onboarding_completed_at)->not->toBeNull();
});

it('allows revisiting earlier unlocked steps', function () {
    [$tenant, $host, $user] = onboardingTenantHost();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/onboarding/1', [
        'display_name' => 'First Name',
    ]);

    $this->post('http://'.$host.'/onboarding/2', [
        'name' => 'Alice',
        'phone' => '',
    ]);

    $this->get('http://'.$host.'/onboarding/1')->assertOk();

    $this->post('http://'.$host.'/onboarding/1', [
        'display_name' => 'Updated Workspace',
    ]);

    tenancy()->initialize($tenant);
    $state = app(WorkspaceOnboardingService::class)->getState();
    expect($state['workspace']['display_name'])->toBe('Updated Workspace');
    tenancy()->end();
});
