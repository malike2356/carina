<?php

declare(strict_types=1);

use App\Enums\TenantCrm\TenantFollowUpStatus;
use App\Enums\TenantCrm\TenantHealthStatus;
use App\Enums\TenantCrm\TenantInferredStatus;
use App\Enums\TenantCrm\TenantLifecycleStage;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformPermission;
use App\Models\Central\PlatformUser;
use App\Models\Central\TenantAccountProfile;
use App\Models\Central\TenantActivityEvent;
use App\Models\Central\TenantFollowUpTask;
use App\Models\Central\WaitlistEntry;
use App\Services\TenantCrm\TenantActivityEventService;
use App\Services\TenantCrm\TenantCrmAutoTaskService;
use App\Services\TenantCrm\TenantHealthInferenceService;
use App\Services\TenantCrm\WaitlistTenantLinkService;
use App\Support\TenantCrm\TenantActivityCatalogue;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
});

test('tenant activity events are logged on login', function (): void {
    $tenant = createCentralTenant();

    app(TenantActivityEventService::class)->logForTenant(
        tenant: $tenant,
        eventType: TenantActivityCatalogue::EVENT_FIRST_LOGIN,
        userId: '42',
        featureName: 'auth',
        actionName: 'login',
    );

    expect(TenantActivityEvent::query()->where('tenant_id', $tenant->id)->count())->toBe(1)
        ->and(TenantActivityEvent::query()->first()->event_type)->toBe(TenantActivityCatalogue::EVENT_FIRST_LOGIN);

    $profile = TenantAccountProfile::query()->where('tenant_id', $tenant->id)->first();
    expect($profile)->not->toBeNull()
        ->and($profile->last_login_at)->not->toBeNull();
});

test('tenant health inference flags dormant workspaces', function (): void {
    $tenant = createCentralTenant([
        'trial_ends_at' => now()->addDays(14),
        'workspace_onboarding_completed_at' => now()->subDays(30),
    ]);
    $profile = TenantAccountProfile::query()->create([
        'tenant_id' => $tenant->id,
        'lifecycle_stage' => TenantLifecycleStage::Trial,
        'last_login_at' => now()->subDays(12),
    ]);

    $result = app(TenantHealthInferenceService::class)->evaluate($tenant, $profile);

    expect($result['inferred_status'])->toBe(TenantInferredStatus::Dormant)
        ->and($result['health_status'])->toBe(TenantHealthStatus::Critical);
});

test('tenant health inference marks expansion candidates', function (): void {
    $tenant = createCentralTenant();
    $profile = TenantAccountProfile::query()->create([
        'tenant_id' => $tenant->id,
        'lifecycle_stage' => TenantLifecycleStage::Active,
        'last_login_at' => now()->subDay(),
        'last_meaningful_action_at' => now()->subDay(),
    ]);

    for ($i = 0; $i < 10; $i++) {
        TenantActivityEvent::query()->create([
            'tenant_id' => $tenant->id,
            'event_type' => TenantActivityCatalogue::EVENT_DEAL_CREATED,
            'event_source' => 'server',
            'feature_name' => 'deals',
            'action_name' => 'create',
            'created_at' => now()->subDays($i % 5),
        ]);
    }

    TenantActivityEvent::query()->create([
        'tenant_id' => $tenant->id,
        'event_type' => TenantActivityCatalogue::EVENT_EXPORT_CREATED,
        'event_source' => 'server',
        'feature_name' => 'reporting',
        'action_name' => 'generate',
        'created_at' => now(),
    ]);

    $result = app(TenantHealthInferenceService::class)->evaluate($tenant, $profile);

    expect($result['inferred_status'])->toBe(TenantInferredStatus::ExpansionCandidate);
});

test('tenant crm manage actions require manage permission', function (): void {
    $support = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_SUPPORT]);
    $viewOnly = PlatformPermission::findOrCreate('view-platform-accounts', 'platform');
    $support->syncPermissions([$viewOnly]);

    $tenant = createCentralTenant();

    $this->actingAs($support, 'platform')
        ->post(route('admin.tenant-crm.store-follow-up', $tenant), [
            'title' => 'Should fail',
            'action_type' => 'general',
            'priority' => 'normal',
        ])
        ->assertForbidden();
});

test('tenant crm list requires view-platform-accounts permission', function (): void {
    $user = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_SUPPORT]);
    $user->syncRoles([]);
    $saasView = PlatformPermission::findOrCreate('view-saas-tenants', 'platform');
    $user->syncPermissions([$saasView]);

    $this->actingAs($user, 'platform')
        ->get(route('admin.tenant-crm.index'))
        ->assertForbidden();
});

test('support with view-platform-accounts can open account list', function (): void {
    $support = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_SUPPORT]);
    $viewAccounts = PlatformPermission::findOrCreate('view-platform-accounts', 'platform');
    $support->syncPermissions([$viewAccounts]);

    $this->actingAs($support, 'platform')
        ->get(route('admin.tenant-crm.index'))
        ->assertOk();
});

test('admin accounts url alias serves account list', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get('/admin/accounts')
        ->assertOk();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.accounts.index'))
        ->assertOk();
});

test('tenant crm list can filter by health status', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $healthy = createCentralTenant(['company_name' => 'Healthy Co']);
    TenantAccountProfile::query()->create([
        'tenant_id' => $healthy->id,
        'lifecycle_stage' => TenantLifecycleStage::Active,
        'health_status' => TenantHealthStatus::Healthy,
        'health_score' => 85,
        'inferred_status' => TenantInferredStatus::Healthy,
    ]);

    $critical = createCentralTenant(['company_name' => 'Critical Co']);
    TenantAccountProfile::query()->create([
        'tenant_id' => $critical->id,
        'lifecycle_stage' => TenantLifecycleStage::Trial,
        'health_status' => TenantHealthStatus::Critical,
        'health_score' => 20,
        'inferred_status' => TenantInferredStatus::Dormant,
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.tenant-crm.index', ['health_status' => TenantHealthStatus::Healthy->value]))
        ->assertOk()
        ->assertSee('Healthy Co', false)
        ->assertDontSee('Critical Co', false);
});

test('follow-up task can be created and completed from account page', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant();
    TenantAccountProfile::query()->create([
        'tenant_id' => $tenant->id,
        'lifecycle_stage' => TenantLifecycleStage::Trial,
    ]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.tenant-crm.store-follow-up', $tenant), [
            'title' => 'Call owner about onboarding',
            'action_type' => 'onboarding',
            'priority' => 'high',
        ])
        ->assertRedirect();

    $task = TenantFollowUpTask::query()->where('tenant_id', $tenant->id)->first();
    expect($task)->not->toBeNull()
        ->and($task->status)->toBe(TenantFollowUpStatus::Open);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.tenant-crm.complete-task', [$tenant, $task]), [
            'outcome' => 'Spoke with owner; scheduled demo',
        ])
        ->assertRedirect();

    expect($task->fresh()->status)->toBe(TenantFollowUpStatus::Completed)
        ->and($task->fresh()->outcome)->toBe('Spoke with owner; scheduled demo');
});

test('mark contacted rejects follow-up tasks from another tenant', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant();
    $otherTenant = createCentralTenant();

    $otherTask = TenantFollowUpTask::query()->create([
        'tenant_id' => $otherTenant->id,
        'title' => 'Other tenant task',
        'action_type' => 'general',
        'priority' => 'normal',
        'status' => TenantFollowUpStatus::Open,
        'source' => 'manual',
    ]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.tenant-crm.mark-contacted', $tenant), [
            'summary' => 'Called tenant owner',
            'channel' => 'phone',
            'outcome' => 'connected',
            'follow_up_task_id' => $otherTask->id,
        ])
        ->assertNotFound();
});

test('super admin can view tenant account detail page', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant(['company_name' => 'Ops Tenant Ltd']);
    TenantAccountProfile::query()->create([
        'tenant_id' => $tenant->id,
        'lifecycle_stage' => TenantLifecycleStage::Trial,
        'health_score' => 55,
        'health_status' => TenantHealthStatus::Watch,
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.tenant-crm.show', $tenant))
        ->assertOk()
        ->assertSee('Ops Tenant Ltd', false)
        ->assertSee('Health (operational)', false);
});

test('waitlist entry links to tenant by owner email', function (): void {
    $email = 'waitlist-link-'.uniqid().'@example.test';

    $entry = WaitlistEntry::factory()->create([
        'email' => $email,
        'confirmed_at' => now(),
    ]);

    $tenant = createCentralTenant(['owner_email' => $email]);

    app(WaitlistTenantLinkService::class)->linkByOwnerEmail($tenant);

    expect($tenant->fresh()->waitlist_entry_id)->toBe($entry->id);
});

test('auto task service does not duplicate open automation tasks', function (): void {
    $tenant = createCentralTenant(['trial_ends_at' => now()->addDays(5)]);
    TenantAccountProfile::query()->create([
        'tenant_id' => $tenant->id,
        'lifecycle_stage' => TenantLifecycleStage::Trial,
        'last_login_at' => now()->subDays(12),
    ]);

    $service = app(TenantCrmAutoTaskService::class);
    $first = $service->runForTenant($tenant);
    $second = $service->runForTenant($tenant);

    expect($first['created'])->toBeGreaterThan(0)
        ->and($second['created'])->toBe(0)
        ->and(TenantFollowUpTask::query()->where('tenant_id', $tenant->id)->whereNotNull('automation_key')->count())->toBeGreaterThan(0);
});
