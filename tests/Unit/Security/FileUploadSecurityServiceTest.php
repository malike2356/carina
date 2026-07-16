<?php

declare(strict_types=1);

use App\Services\Security\FileUploadSecurityService;
use Illuminate\Http\UploadedFile;

beforeEach(function (): void {
    config([
        'carina_security.upload.max_size_mb' => 20,
        'carina_security.upload.max_archive_uncompressed_mb' => 100,
    ]);
});

function uploadSecurityService(): FileUploadSecurityService
{
    return app(FileUploadSecurityService::class);
}

function uploadedFileFromPath(string $path, string $originalName, ?string $testMime = null): UploadedFile
{
    return new UploadedFile(
        $path,
        $originalName,
        $testMime,
        UPLOAD_ERR_OK,
        true,
    );
}

it('validate returns null for a valid PDF under 20 MB', function (): void {
    $file = UploadedFile::fake()->create('report.pdf', 100, 'application/pdf');

    expect(uploadSecurityService()->validate($file))->toBeNull();
});

it('validate returns error for a file exceeding 20 MB', function (): void {
    $file = UploadedFile::fake()->create('huge.pdf', 20481, 'application/pdf');

    expect(uploadSecurityService()->validate($file))
        ->toContain('maximum allowed size');
});

it('validate returns error for a PHP file', function (): void {
    $file = UploadedFile::fake()->create('shell.php', 1, 'text/plain');

    expect(uploadSecurityService()->validate($file))
        ->toContain("extension 'php'");
});

it('validate returns error for an HTML file', function (): void {
    $file = UploadedFile::fake()->create('page.html', 1, 'text/html');

    expect(uploadSecurityService()->validate($file))
        ->toContain('not permitted');
});

it('validate returns error for MIME type not in allowlist', function (): void {
    $file = UploadedFile::fake()->create('archive.zip', 10, 'application/zip');

    expect(uploadSecurityService()->validate($file))
        ->toContain('not permitted');
});

it('validate returns error for double extension', function (): void {
    $tmp = tempnam(sys_get_temp_dir(), 'vault');
    file_put_contents($tmp, '%PDF-1.4');
    $file = uploadedFileFromPath($tmp, 'invoice.pdf.php', 'application/pdf');

    expect(uploadSecurityService()->validate($file))->not->toBeNull();
});

it('validate returns error for extension MIME mismatch', function (): void {
    $tmp = tempnam(sys_get_temp_dir(), 'vault');
    file_put_contents($tmp, '%PDF-1.4');
    $file = uploadedFileFromPath($tmp, 'scan.png', 'application/pdf');

    expect(uploadSecurityService()->validate($file))
        ->toContain('does not match');
});

it('safeStorageFilename returns a UUID-based name with correct extension', function (): void {
    $file = UploadedFile::fake()->create('original-name.pdf', 10, 'application/pdf');

    $name = uploadSecurityService()->safeStorageFilename($file);

    expect($name)->toMatch('/^[0-9a-f\-]{36}\.pdf$/');
});

it('sanitiseDisplayName strips path separators and null bytes', function (): void {
    $clean = uploadSecurityService()->sanitiseDisplayName("..\\evil/\0contract.pdf");

    expect($clean)->toBe('evilcontract.pdf');
});

it('validate rejects SVG files', function (): void {
    $file = UploadedFile::fake()->create('logo.svg', 1, 'image/svg+xml');

    expect(uploadSecurityService()->validate($file))
        ->toContain('not permitted');
});
