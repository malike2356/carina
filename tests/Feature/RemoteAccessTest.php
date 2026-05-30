<?php

declare(strict_types=1);

use App\Enums\RemoteAccessConsentMethod;
use App\Models\Central\PlatformUser;
use App\Models\Central\RemoteAccessLog;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('denies initiate when gdpr acknowledgement missing', function () {
    Notification::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant(['allow_remote_access' => true]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.initiate', $tenant), [
            'reason' => 'Need to inspect billing configuration for the customer.',
        ])
        ->assertSessionHasErrors('gdpr');
});

it('redirects to tenant edit when redirect_to is tenant_edit', function () {
    Notification::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant(['allow_remote_access' => true]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.gdpr-confirm'), ['gdpr_confirmed' => '1']);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.initiate', $tenant), [
            'reason' => 'Help customer finish onboarding on mobile.',
            'redirect_to' => 'tenant_edit',
        ])
        ->assertRedirect(route('admin.saas-tenancy.edit', $tenant))
        ->assertSessionHas('remote_access_entry_url');
});

it('allows initiate when gdpr confirmed and toggle on', function () {
    Notification::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant(['allow_remote_access' => true]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.gdpr-confirm'), [
            'gdpr_confirmed' => '1',
        ])
        ->assertRedirect();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.initiate', $tenant), [
            'reason' => 'Need to inspect billing configuration for the customer.',
        ])
        ->assertRedirect(route('admin.remote-access.index'));

    expect(RemoteAccessLog::on('central')->count())->toBe(1);
});

it('blocks initiate when toggle off and no override permission', function () {
    Notification::fake();

    $admin = PlatformUser::factory()->admin()->create();
    $tenant = createCentralTenant(['allow_remote_access' => false]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.gdpr-confirm'), ['gdpr_confirmed' => '1']);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.initiate', $tenant), [
            'reason' => str_repeat('x', 60),
        ])
        ->assertForbidden();
});

it('allows super override with long reason when toggle off', function () {
    Notification::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant(['allow_remote_access' => false]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.gdpr-confirm'), ['gdpr_confirmed' => '1']);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.remote-access.initiate', $tenant), [
            'reason' => str_repeat('Production database integrity incident. ', 4),
        ])
        ->assertRedirect(route('admin.remote-access.index'));

    $tenant->refresh();
    expect((bool) $tenant->allow_remote_access)->toBeFalse();

    $log = RemoteAccessLog::on('central')->where('tenant_id', $tenant->id)->latest('id')->first();
    expect($log)->not->toBeNull();
    expect($log->consent_method->value)->toBe('super_override');
});

it('workspace admin can update remote access toggle on central tenant', function () {
    $svc = app(TenantCreationService::class);
    $tenant = $svc->createTenant([
        'company_name' => 'RA Toggle Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ra-toggle.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    $user->assignRole('tenant_admin');
    tenancy()->end();

    $host = $tenant->domains->first()->domain.'.'.config('tenancy.tenant_base_domain');

    $url = 'http://'.$host.'/settings/remote-access';

    $this->actingAs($user, 'web')
        ->call('PUT', $url, [
            'allow_remote_access' => 1,
        ], [], [], [
            'HTTP_HOST' => $host,
            'SERVER_NAME' => $host,
        ])
        ->assertRedirect();

    $tenant->refresh();
    expect((bool) $tenant->allow_remote_access)->toBeTrue();
});

it('cleanup command closes expired sessions', function () {
    Notification::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant();

    RemoteAccessLog::on('central')->create([
        'platform_user_id' => $admin->getKey(),
        'tenant_id' => $tenant->getKey(),
        'access_started_at' => now()->subHours(10),
        'tenant_session_entered_at' => now()->subHours(9),
        'last_activity_at' => now()->subHours(9),
        'reason' => 'old',
        'consent_method' => RemoteAccessConsentMethod::TenantToggle,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'test',
    ]);

    $this->artisan('remote-access:cleanup-expired')->assertSuccessful();

    expect(RemoteAccessLog::on('central')->whereNull('access_ended_at')->count())->toBe(0);
});
