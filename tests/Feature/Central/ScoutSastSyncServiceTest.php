<?php

declare(strict_types=1);

use App\Models\Central\SecurityFinding;
use App\Services\Security\SastScanService;

it('creates findings from phpstan json files shape', function () {
    $json = json_encode([
        'files' => [
            '/srv/app/Services/Demo.php' => [
                'messages' => [
                    [
                        'line' => 9,
                        'message' => 'Undefined variable: $demo',
                        'ignorable' => false,
                    ],
                ],
            ],
        ],
        'errors' => [],
    ], JSON_THROW_ON_ERROR);

    $service = new SastScanService;
    $out = $service->syncFindingsFromPhpStanJson($json);

    expect($out)->toHaveCount(1)
        ->and($out[0])->toBeInstanceOf(SecurityFinding::class);

    $this->assertDatabaseHas('security_findings', [
        'source' => 'larastan',
        'status' => 'open',
    ], 'central');
});

it('returns empty for invalid phpstan json', function () {
    $service = new SastScanService;
    expect($service->syncFindingsFromPhpStanJson('not-json'))->toBe([]);
});

it('resolves open larastan findings when scan is clean', function () {
    SecurityFinding::query()->create([
        'severity' => 'medium',
        'title' => 'Stale',
        'description' => 'x',
        'status' => 'open',
        'remediation' => 'fix',
        'reference' => 'larastan:stale-test-ref',
        'source' => 'larastan',
    ]);

    $json = json_encode(['files' => [], 'errors' => []], JSON_THROW_ON_ERROR);
    (new SastScanService)->syncFindingsFromPhpStanJson($json);

    $this->assertDatabaseHas('security_findings', [
        'reference' => 'larastan:stale-test-ref',
        'status' => 'resolved',
    ], 'central');
});
