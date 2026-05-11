<?php

declare(strict_types=1);

/**
 * No DB: asserts viCal routes are registered when the app boots.
 */
it('registers viCal API, hub, and public booking route names', function (): void {
    $registered = collect(app('router')->getRoutes())
        ->map(fn ($r) => $r->getName())
        ->filter()
        ->values();

    foreach ([
        'tenant.api.vcal.event-types.index',
        'tenant.api.vcal.event-types.store',
        'tenant.api.vcal.event-types.update',
        'tenant.api.vcal.event-types.destroy',
        'tenant.api.vcal.availability-rules.index',
        'tenant.api.vcal.availability-rules.store',
        'tenant.api.vcal.availability-rules.update',
        'tenant.api.vcal.availability-rules.destroy',
        'tenant.api.vcal.blackouts.index',
        'tenant.api.vcal.blackouts.store',
        'tenant.api.vcal.blackouts.update',
        'tenant.api.vcal.blackouts.destroy',
        'tenant.api.vcal.bookings.index',
        'tenant.api.vcal.bookings.store',
        'tenant.api.vcal.bookings.approve',
        'tenant.api.vcal.bookings.reject',
        'tenant.api.vcal.bookings.cancel',
        'tenant.vical.index',
        'tenant.vical.slug',
        'tenant.vical.event-types.store',
        'tenant.vical.event-types.edit',
        'tenant.vical.event-types.update',
        'tenant.vical.event-types.destroy',
        'tenant.vical.availability-rules.store',
        'tenant.vical.availability-rules.edit',
        'tenant.vical.availability-rules.update',
        'tenant.vical.availability-rules.destroy',
        'tenant.vical.blackouts.store',
        'tenant.vical.blackouts.edit',
        'tenant.vical.blackouts.update',
        'tenant.vical.blackouts.destroy',
        'tenant.vical.bookings.approve',
        'tenant.vical.bookings.reject',
        'tenant.book.public.show',
        'tenant.book.public.slots',
        'tenant.book.public.store',
        'tenant.book.public.thanks',
        'tenant.book.public.deposit.return',
    ] as $name) {
        expect($registered)->toContain($name);
    }
});
