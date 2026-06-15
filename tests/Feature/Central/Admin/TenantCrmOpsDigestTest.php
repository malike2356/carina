<?php

declare(strict_types=1);

use App\Enums\TenantCrm\TenantFollowUpStatus;
use App\Enums\TenantCrm\TenantHealthStatus;
use App\Enums\TenantCrm\TenantInferredStatus;
use App\Enums\TenantCrm\TenantLifecycleStage;
use App\Mail\Central\TenantCrmOpsDigestMail;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\TenantAccountProfile;
use App\Models\Central\TenantFollowUpTask;
use App\Services\TenantCrm\TenantCrmOpsDigestService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'saas_tenant_management')->update(['enabled' => true]);
});

test('ops digest build returns expected sections', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tenant = createCentralTenant(['company_name' => 'Digest Tenant Ltd', 'trial_ends_at' => now()->addDays(3)]);

    TenantAccountProfile::query()->create([
        'tenant_id' => $tenant->id,
        'lifecycle_stage' => TenantLifecycleStage::Trial,
        'health_status' => TenantHealthStatus::Critical,
        'inferred_status' => TenantInferredStatus::AtRisk,
    ]);

    TenantFollowUpTask::query()->create([
        'tenant_id' => $tenant->id,
        'owner_platform_user_id' => $admin->id,
        'title' => 'Call owner',
        'action_type' => 'general',
        'priority' => 'high',
        'status' => TenantFollowUpStatus::Open,
        'due_at' => now()->subDay(),
        'source' => 'manual',
        'created_by_platform_user_id' => $admin->id,
    ]);

    $digest = app(TenantCrmOpsDigestService::class)->build($admin);

    expect($digest)->toHaveKeys([
        'generated_at',
        'recipient_name',
        'my_open_tasks',
        'due_today',
        'overdue_tasks',
        'trials_ending_7d',
        'at_risk_accounts',
        'expansion_candidates',
        'counts',
    ])
        ->and($digest['counts']['overdue_tasks'])->toBe(1)
        ->and($digest['counts']['trials_ending_7d'])->toBe(1)
        ->and($digest['overdue_tasks'][0]['title'])->toBe('Call owner');
});

test('ops digest command dry run exits successfully', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->artisan('tenant-crm:send-ops-digest', [
        '--user' => (string) $admin->id,
        '--dry-run' => true,
    ])->assertSuccessful();
});

test('ops digest command sends mail to eligible platform user', function (): void {
    Mail::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->artisan('tenant-crm:send-ops-digest', [
        '--user' => (string) $admin->id,
    ])->assertSuccessful();

    Mail::assertSent(TenantCrmOpsDigestMail::class, function (TenantCrmOpsDigestMail $mail) use ($admin): bool {
        return $mail->hasTo($admin->email);
    });
});

test('ops digest recipients include profile opt-in and env allowlist', function (): void {
    config(['tenant_crm.ops_digest.opt_in_user_ids' => '']);

    $optedIn = PlatformUser::factory()->superAdmin()->create([
        'tenant_crm_ops_digest_opt_in' => true,
    ]);
    $notOptedIn = PlatformUser::factory()->superAdmin()->create([
        'tenant_crm_ops_digest_opt_in' => false,
    ]);

    $recipients = app(TenantCrmOpsDigestService::class)->digestRecipients();
    $recipientIds = array_map(fn (PlatformUser $user): int => (int) $user->id, $recipients);

    expect($recipientIds)->toContain($optedIn->id)
        ->and($recipientIds)->not->toContain($notOptedIn->id);
});

test('ops digest recipients fall back to all eligible when no explicit opt-ins', function (): void {
    config(['tenant_crm.ops_digest.opt_in_user_ids' => '']);

    $first = PlatformUser::factory()->superAdmin()->create([
        'tenant_crm_ops_digest_opt_in' => false,
    ]);
    $second = PlatformUser::factory()->superAdmin()->create([
        'tenant_crm_ops_digest_opt_in' => false,
    ]);

    $recipientIds = array_map(
        fn (PlatformUser $user): int => (int) $user->id,
        app(TenantCrmOpsDigestService::class)->digestRecipients()
    );

    expect($recipientIds)->toContain($first->id, $second->id);
});

test('ops digest env allowlist merges with profile opt-in', function (): void {
    $envUser = PlatformUser::factory()->superAdmin()->create([
        'tenant_crm_ops_digest_opt_in' => false,
    ]);
    $profileUser = PlatformUser::factory()->superAdmin()->create([
        'tenant_crm_ops_digest_opt_in' => true,
    ]);
    PlatformUser::factory()->superAdmin()->create([
        'tenant_crm_ops_digest_opt_in' => false,
    ]);

    config(['tenant_crm.ops_digest.opt_in_user_ids' => json_encode([(int) $envUser->id])]);

    $recipientIds = array_map(
        fn (PlatformUser $user): int => (int) $user->id,
        app(TenantCrmOpsDigestService::class)->digestRecipients()
    );

    expect($recipientIds)->toContain($envUser->id, $profileUser->id)
        ->and($recipientIds)->toHaveCount(2);
});
