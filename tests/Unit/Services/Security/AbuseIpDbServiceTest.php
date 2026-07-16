<?php

declare(strict_types=1);

use App\Services\Security\AbuseIpDbService;
use Illuminate\Support\Facades\Http;

it('returns null when no API key is configured', function (): void {
    config(['services.abuseipdb.key' => '']);

    expect(app(AbuseIpDbService::class)->check('1.2.3.4'))->toBeNull();
});

it('returns null on HTTP failure', function (): void {
    config(['services.abuseipdb.key' => 'test-key']);
    Http::fake(['*' => Http::response([], 500)]);

    expect(app(AbuseIpDbService::class)->check('1.2.3.4'))->toBeNull();
});

it('returns a score on success', function (): void {
    config(['services.abuseipdb.key' => 'test-key']);
    Http::fake(['*' => Http::response([
        'data' => ['abuseConfidenceScore' => 85, 'totalReports' => 12],
    ])]);

    $result = app(AbuseIpDbService::class)->check('1.2.3.4');

    expect($result)->toBe(['score' => 85, 'total_reports' => 12]);
});

it('returns null for invalid IPs', function (): void {
    config(['services.abuseipdb.key' => 'test-key']);

    expect(app(AbuseIpDbService::class)->check('not-an-ip'))->toBeNull();
});
