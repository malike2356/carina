<?php

declare(strict_types=1);

use App\Services\Backup\BackupEncryptionService;

beforeEach(function () {
    config(['backup.encryption_key' => bin2hex(random_bytes(32))]);
});

it('roundtrips encrypt and decrypt', function () {
    $svc = new BackupEncryptionService;
    $plain = sys_get_temp_dir().'/bk-plain-'.uniqid();
    $cipher = sys_get_temp_dir().'/bk-cipher-'.uniqid();
    $out = sys_get_temp_dir().'/bk-out-'.uniqid();

    file_put_contents($plain, 'hello backup world');

    $svc->encryptBackup($plain, $cipher);
    expect(file_exists($cipher))->toBeTrue();

    $svc->decryptBackup($cipher, $out);
    expect(file_get_contents($out))->toBe('hello backup world');

    @unlink($plain);
    @unlink($cipher);
    @unlink($out);
});

it('generates a 64-char hex key', function () {
    $k = (new BackupEncryptionService)->generateKey();
    expect(strlen($k))->toBe(64);
});
