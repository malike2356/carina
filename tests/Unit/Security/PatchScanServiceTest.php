<?php

declare(strict_types=1);

use App\Models\Central\SecurityFinding;
use App\Services\Security\PatchScanService;

it('creates findings from composer audit shaped json', function () {
    $json = json_encode([
        'advisories' => [
            'vendor/hole-pkg' => [
                [
                    'advisoryId' => 'PKSA-abcd-efgh',
                    'title' => 'Remote code execution',
                    'cve' => 'CVE-2099-1',
                    'link' => 'https://example.test/advisory',
                    'severity' => 'high',
                    'sources' => [],
                ],
            ],
        ],
    ], JSON_THROW_ON_ERROR);

    $service = new PatchScanService;
    $out = $service->syncFindingsFromAuditJson($json);

    expect($out)->toHaveCount(1)
        ->and($out[0])->toBeInstanceOf(SecurityFinding::class);

    $this->assertDatabaseHas('security_findings', [
        'reference' => 'composer-audit:PKSA-abcd-efgh',
        'severity' => 'high',
        'source' => 'composer_audit',
    ], 'central');
});

it('returns empty for invalid json', function () {
    $service = new PatchScanService;
    expect($service->syncFindingsFromAuditJson('not-json'))->toBe([]);
});
