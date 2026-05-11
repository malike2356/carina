<?php

declare(strict_types=1);

use App\Enums\Backup\BackupJobStatus;
use App\Enums\Backup\BackupJobType;
use App\Events\Central\BackupJobCompleted;
use App\Listeners\Central\NotifySlackOnBackupCompleted;
use App\Models\Central\BackupDestination;
use App\Models\Central\BackupJob;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\RestoreJob;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'platform_backup_dr')->update(['enabled' => true]);
});

it('redirects viewers without platform admin access away from backups', function () {
    $u = PlatformUser::factory()->create(['role' => 'viewer']);

    $this->actingAs($u, 'platform')
        ->get(route('admin.backups.index'))
        ->assertRedirect(route('central.login'));
});

it('shows backups hub for super admin', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.backups.index'))
        ->assertOk()
        ->assertSee('Backups');
});

it('queues a manual backup from the hub', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.backups.store'), [
            'type' => 'database',
            'name' => 'Feature test backup',
            'retention_days' => 14,
        ])
        ->assertRedirect(route('admin.backups.index'));

    expect(BackupJob::on('central')->where('name', 'Feature test backup')->exists())->toBeTrue();
});

it('dispatches BackupJobCompleted when a backup run finishes', function () {
    Event::fake([BackupJobCompleted::class]);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.backups.store'), [
            'type' => 'database',
            'name' => 'Event probe backup',
            'retention_days' => 7,
        ])
        ->assertRedirect(route('admin.backups.index'));

    Event::assertDispatched(BackupJobCompleted::class, function (BackupJobCompleted $e): bool {
        return $e->job->name === 'Event probe backup';
    });
});

it('queues a restore job from the hub', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $job = BackupJob::on('central')->create([
        'name' => 'Restore source',
        'type' => BackupJobType::Database,
        'status' => BackupJobStatus::Completed,
        'path' => 'nonexistent.zip',
        'checksum' => null,
        'size_bytes' => null,
    ]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.backups.restore', $job))
        ->assertRedirect(route('admin.backups.index'));

    expect(RestoreJob::on('central')->where('backup_job_id', $job->id)->exists())->toBeTrue();
});

it('creates a destination and runs test', function () {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.backups.destinations.store'), [
            'name' => 'Local mirror',
            'driver' => 'local',
            'config_json' => json_encode(['path' => storage_path('app/backup-test-probe')]),
            'is_primary' => '1',
        ])
        ->assertRedirect(route('admin.backups.destinations.index'));

    $d = BackupDestination::on('central')->where('name', 'Local mirror')->first();
    expect($d)->not->toBeNull();

    $this->actingAs($admin, 'platform')
        ->post(route('admin.backups.destinations.test', $d))
        ->assertRedirect(route('admin.backups.destinations.index'));
});

it('does not call slack when platform_backup_slack_notify is off', function (): void {
    Http::fake();
    FeatureFlag::query()->where('key', 'platform_backup_slack_notify')->update(['enabled' => false]);
    config(['backup.slack_webhook_url' => 'https://hooks.slack.com/services/fake/fake/fake']);

    $job = BackupJob::on('central')->create([
        'name' => 'No slack backup',
        'type' => BackupJobType::Database,
        'status' => BackupJobStatus::Completed,
        'path' => 'test.zip',
        'checksum' => null,
        'size_bytes' => 100,
    ]);

    app(NotifySlackOnBackupCompleted::class)->handle(new BackupJobCompleted($job));

    Http::assertNothingSent();
});

it('does not call slack when webhook url is empty', function (): void {
    Http::fake();
    FeatureFlag::query()->where('key', 'platform_backup_slack_notify')->update(['enabled' => true]);
    config(['backup.slack_webhook_url' => '']);

    $job = BackupJob::on('central')->create([
        'name' => 'No url backup',
        'type' => BackupJobType::Database,
        'status' => BackupJobStatus::Completed,
        'path' => 'test.zip',
        'checksum' => null,
        'size_bytes' => null,
    ]);

    app(NotifySlackOnBackupCompleted::class)->handle(new BackupJobCompleted($job));

    Http::assertNothingSent();
});

it('posts json to slack when flag is on and webhook url is set', function (): void {
    FeatureFlag::query()->where('key', 'platform_backup_slack_notify')->update(['enabled' => true]);
    $webhook = 'https://hooks.slack.com/services/AAA/BBB/CCC';
    config(['backup.slack_webhook_url' => $webhook]);

    Http::fake([$webhook => Http::response('ok', 200)]);

    $job = BackupJob::on('central')->create([
        'name' => 'Slack probe backup',
        'type' => BackupJobType::Database,
        'status' => BackupJobStatus::Completed,
        'path' => 'probe.zip',
        'checksum' => 'abc',
        'size_bytes' => 2048,
    ]);

    app(NotifySlackOnBackupCompleted::class)->handle(new BackupJobCompleted($job));

    Http::assertSent(function ($request) use ($webhook, $job): bool {
        if ($request->url() !== $webhook) {
            return false;
        }
        $data = $request->data();

        return isset($data['text'])
            && str_contains((string) $data['text'], 'Slack probe backup')
            && str_contains((string) $data['text'], (string) $job->uuid);
    });
});
