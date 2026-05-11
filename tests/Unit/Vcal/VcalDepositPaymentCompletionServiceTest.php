<?php

declare(strict_types=1);

use App\Services\Vcal\VcalDepositPaymentCompletionService;

it('ignores checkout sessions that are not viCal deposits', function (): void {
    $svc = app(VcalDepositPaymentCompletionService::class);

    expect($svc->completeFromWebhookSession([
        'mode' => 'payment',
        'payment_status' => 'paid',
        'metadata' => ['tenant_id' => 'x', 'booking_id' => '1'],
    ]))->toBeFalse();
});
