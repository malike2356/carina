<?php

declare(strict_types=1);

use App\Services\Vcal\VcalRoundRobinService;

test('publicSlotsRangeUtc uses start of from date in UTC when guest timezone is UTC', function () {
    $svc = app(VcalRoundRobinService::class);
    [$start, $end] = $svc->publicSlotsRangeUtc('2026-06-01', 31, 'UTC');

    expect($start->timezone('UTC')->format('Y-m-d H:i'))->toBe('2026-06-01 00:00');
    expect($end->timezone('UTC')->format('Y-m-d H:i'))->toBe('2026-07-02 00:00');
});

test('publicSlotsRangeUtc anchors from date at guest local midnight', function () {
    $svc = app(VcalRoundRobinService::class);
    [$start] = $svc->publicSlotsRangeUtc('2026-06-01', 1, 'Asia/Tokyo');

    expect($start->timezone('Asia/Tokyo')->format('Y-m-d H:i'))->toBe('2026-06-01 00:00');
});

test('publicSlotsRangeUtc rejects invalid from date', function () {
    $svc = app(VcalRoundRobinService::class);
    $svc->publicSlotsRangeUtc('not-a-date', 7, 'UTC');
})->throws(InvalidArgumentException::class);
