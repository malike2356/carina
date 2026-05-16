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
        'tenant.vical.public-api-secret',
        'tenant.vical.event-types.store',
        'tenant.vical.event-types.create',
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
        'tenant.vical.calendar',
        'tenant.vical.analytics',
        'tenant.vical.bookings.show',
        'tenant.vical.bookings.notes',
        'tenant.vical.bookings.recording',
        'tenant.vical.bookings.reschedule',
        'tenant.vical.bookings.cancel-hub',
        'tenant.vical.bookings.mentorship',
        'tenant.vical.bookings.outcome',
        'tenant.vical.group-events.index',
        'tenant.vical.group-events.store',
        'tenant.vical.group-events.edit',
        'tenant.vical.group-events.update',
        'tenant.vical.group-events.destroy',
        'tenant.vical.group-events.registrations.csv',
        'tenant.vical.mentor-directory',
        'tenant.book.public.show',
        'tenant.book.public.slots',
        'tenant.book.public.store',
        'tenant.book.public.thanks',
        'tenant.book.public.ics',
        'tenant.book.public.cancel.show',
        'tenant.book.public.cancel',
        'tenant.book.public.reschedule.show',
        'tenant.book.public.reschedule',
        'tenant.book.public.calendar',
        'tenant.book.public.deposit.return',
        'tenant.book.embed.show',
        'tenant.api.vcal.public.event-types',
        'tenant.api.vcal.public.calendar',
        'tenant.api.vcal.public.slots',
        'tenant.api.vcal.public.bookings.store',
        'tenant.api.vcal.intake-pools.index',
        'tenant.api.vcal.intake-pools.store',
        'tenant.api.vcal.intake-pools.update',
        'tenant.api.vcal.intake-pools.destroy',
        'tenant.vical.public.programmes',
        'tenant.vical.public.mentors',
        'tenant.vical.public.group-events.show',
        'tenant.vical.public.group-events.register',
    ] as $name) {
        expect($registered)->toContain($name);
    }
});
