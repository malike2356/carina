<?php

declare(strict_types=1);

use App\Models\Central\SecurityFinding;
use App\Services\Security\ComposerPatchService;

it('does not run composer when a package cannot be determined from the finding', function (): void {
    $finding = new SecurityFinding([
        'title' => 'General dependency finding',
        'remediation' => 'Review release notes manually.',
        'source' => 'composer_audit',
        'status' => 'open',
    ]);

    $result = app(ComposerPatchService::class)->patchFinding($finding);

    expect($result['ok'])->toBeFalse()
        ->and($result['output'])->toBe('Could not determine package name from finding.')
        ->and($result['finding'])->toBe($finding);
});
