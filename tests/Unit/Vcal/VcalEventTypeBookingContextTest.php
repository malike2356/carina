<?php

declare(strict_types=1);

use App\Models\Tenant\Vcal\VcalEventType;

it('resolves allowed booking context keys', function (): void {
    $t = new VcalEventType;
    $t->allowed_booking_contexts = null;
    expect($t->resolvedAllowedBookingContextKeys())->toBe(['mentorship', 'learning_path']);

    $t->allowed_booking_contexts = [];
    expect($t->resolvedAllowedBookingContextKeys())->toBe([]);

    $t->allowed_booking_contexts = ['mentorship', 'learning_path', 'invalid'];
    expect($t->resolvedAllowedBookingContextKeys())->toBe(['mentorship', 'learning_path']);
});

it('maps boolean flags to stored context keys', function (): void {
    expect(VcalEventType::allowedContextsFromBooleanFlags(true, true))->toBe(['mentorship', 'learning_path'])
        ->and(VcalEventType::allowedContextsFromBooleanFlags(false, false))->toBe([]);
});
