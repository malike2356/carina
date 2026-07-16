<?php

declare(strict_types=1);

use App\Services\Carina\CrossTenantAnalyticsAnonymiser;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;

it('reduces postcode to outcode only', function (): void {
    $svc = new CrossTenantAnalyticsAnonymiser;

    expect($svc->postcodeToOutcode('PO5 4XY'))->toBe('PO5')
        ->and($svc->postcodeToOutcode('  ec1a 1bb '))->toBe('EC1A');
});

it('strips PII keys and returns cohort failure below minimum', function (): void {
    $svc = new CrossTenantAnalyticsAnonymiser;

    $rows = [
        ['name' => 'Jane Doe', 'postcode' => 'SW1A 1AA', 'metric' => 1],
    ];

    $result = $svc->anonymiseCohort($rows, 5);

    expect($result['ok'])->toBeFalse()
        ->and($result['reason'])->toBe(CrossTenantAnalyticsAnonymiser::REASON_BELOW_MINIMUM_COHORT)
        ->and($result['disclaimer'])->toBe(CrossTenantAnalyticsAnonymiser::DISCLAIMER);
});

it('anonymises rows when cohort is large enough', function (): void {
    $svc = new CrossTenantAnalyticsAnonymiser;

    $rows = array_fill(0, 5, [
        'email' => 'a@b.com',
        'postcode' => 'M1 1AE',
        'value' => 10,
    ]);

    $result = $svc->anonymiseCohort($rows, 5);

    expect($result['ok'])->toBeTrue()
        ->and($result['rows'][0])->not->toHaveKey('email')
        ->and($result['rows'][0]['postcode'])->toBe('M1')
        ->and($result['disclaimer'])->toBe(CrossTenantAnalyticsAnonymiser::DISCLAIMER);
});

it('logs cross-tenant analytics with hashed tenant ids', function (): void {
    Event::fake([MessageLogged::class]);

    $svc = new CrossTenantAnalyticsAnonymiser;

    $svc->logCrossTenantQuery('benchmark_avg', ['tenant-a', 'tenant-b'], 12, true);

    Event::assertDispatched(MessageLogged::class, function (MessageLogged $e): bool {
        return $e->message === 'carina.cross_tenant_analytics'
            && ($e->context['operation'] ?? null) === 'benchmark_avg'
            && ($e->context['row_count'] ?? null) === 12
            && ($e->context['released'] ?? null) === true
            && count($e->context['tenant_id_hashes'] ?? []) === 2;
    });
});

it('anonymise cohort with audit logs released flag', function (): void {
    Event::fake([MessageLogged::class]);

    $svc = new CrossTenantAnalyticsAnonymiser;

    $rows = array_fill(0, 3, ['x' => 1]);
    $svc->anonymiseCohortWithAudit('op_small', ['a', 'b'], $rows, 5);

    Event::assertDispatched(MessageLogged::class, function (MessageLogged $e): bool {
        return $e->message === 'carina.cross_tenant_analytics'
            && ($e->context['operation'] ?? null) === 'op_small'
            && ($e->context['released'] ?? null) === false
            && ($e->context['row_count'] ?? null) === 3;
    });
});
