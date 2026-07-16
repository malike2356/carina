<?php

declare(strict_types=1);

use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Vcal\Conferencing\VcalConferencingFactory;
use App\Services\Vcal\Conferencing\VcalGoogleMeetConferencingAdapter;
use App\Services\Vcal\Conferencing\VcalZoomConferencingAdapter;

it('routes explicit zoom location to the zoom conferencing adapter', function (): void {
    $factory = app(VcalConferencingFactory::class);
    $type = new VcalEventType(['location_type' => 'zoom']);

    expect($factory->make($type))->toBeInstanceOf(VcalZoomConferencingAdapter::class);
});

it('keeps legacy auto zoom event types routed to zoom', function (): void {
    $factory = app(VcalConferencingFactory::class);
    $type = new VcalEventType(['auto_zoom_meeting' => true]);

    expect($factory->make($type))->toBeInstanceOf(VcalZoomConferencingAdapter::class);
});

it('routes google meet location to the google meet adapter', function (): void {
    $factory = app(VcalConferencingFactory::class);
    $type = new VcalEventType(['location_type' => 'google_meet']);

    expect($factory->make($type))->toBeInstanceOf(VcalGoogleMeetConferencingAdapter::class);
});

it('does not auto attach links for manual location types', function (): void {
    $factory = app(VcalConferencingFactory::class);
    $type = new VcalEventType(['location_type' => 'in_person']);

    expect($factory->make($type))->toBeNull();
});
