<?php

declare(strict_types=1);

use App\Support\Billing\BillingPresentation;

it('uses translated interval suffix for known intervals', function () {
    expect(BillingPresentation::planIntervalSuffix('month'))
        ->toBe(__('billing.dashboard.price_suffix.month'))
        ->and(BillingPresentation::planIntervalSuffix('year'))
        ->toBe(__('billing.dashboard.price_suffix.year'));
});

it('falls back to monthly suffix for unknown intervals', function () {
    expect(BillingPresentation::planIntervalSuffix('quarter'))
        ->toBe(__('billing.dashboard.price_suffix.month'));
});
