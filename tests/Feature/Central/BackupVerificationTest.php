<?php

declare(strict_types=1);

use App\Enums\Backup\BackupJobStatus;
use App\Enums\Backup\BackupJobType;
use App\Models\Central\BackupJob;
use App\Services\Backup\BackupVerificationService;
use Illuminate\Support\Facades\Storage;

it('verifies integrity when checksum matches stored file', function () {
    Storage::fake('local');
    config(['backup.disk' => 'local']);

    Storage::disk('local')->put('platform-backups/test.zip', 'payload');

    $job = BackupJob::on('central')->create([
        'name' => 't',
        'type' => BackupJobType::Database,
        'status' => BackupJobStatus::Completed,
        'path' => 'platform-backups/test.zip',
        'checksum' => hash('sha256', 'payload'),
        'size_bytes' => 7,
    ]);

    $svc = new BackupVerificationService;
    expect($svc->verifyIntegrity($job))->toBeTrue();
});
