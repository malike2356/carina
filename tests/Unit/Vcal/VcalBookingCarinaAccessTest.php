<?php

declare(strict_types=1);

use App\Models\Tenant\MentorshipRelationship;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Services\Vcal\VcalBookingCarinaAccess;

it('allows host tenant admin mentor and mentee when booking carries mentorship', function (): void {
    $svc = app(VcalBookingCarinaAccess::class);

    $mentor = Mockery::mock(User::class);
    $mentor->allows('getKey')->andReturn(10);
    $mentor->allows('isTenantAdmin')->andReturn(false);

    $mentee = Mockery::mock(User::class);
    $mentee->allows('getKey')->andReturn(20);
    $mentee->allows('isTenantAdmin')->andReturn(false);

    $stranger = Mockery::mock(User::class);
    $stranger->allows('getKey')->andReturn(99);
    $stranger->allows('isTenantAdmin')->andReturn(false);

    $admin = Mockery::mock(User::class);
    $admin->allows('getKey')->andReturn(5);
    $admin->allows('isTenantAdmin')->andReturn(true);

    $rel = new MentorshipRelationship([
        'mentor_id' => 10,
        'mentee_id' => 20,
        'status' => 'active',
    ]);
    $rel->syncOriginal();

    $booking = new VcalBooking([
        'host_user_id' => 10,
        'mentorship_relationship_id' => 1,
    ]);
    $booking->syncOriginal();
    $booking->setRelation('mentorshipRelationship', $rel);

    expect($svc->userCanOpenConversation($mentor, $booking))->toBeTrue()
        ->and($svc->userCanOpenConversation($mentee, $booking))->toBeTrue()
        ->and($svc->userCanOpenConversation($admin, $booking))->toBeTrue()
        ->and($svc->userCanOpenConversation($stranger, $booking))->toBeFalse();
});

it('denies non-host when no mentorship link exists', function (): void {
    $svc = app(VcalBookingCarinaAccess::class);

    $host = Mockery::mock(User::class);
    $host->allows('getKey')->andReturn(1);
    $host->allows('isTenantAdmin')->andReturn(false);

    $other = Mockery::mock(User::class);
    $other->allows('getKey')->andReturn(2);
    $other->allows('isTenantAdmin')->andReturn(false);

    $booking = new VcalBooking([
        'host_user_id' => 1,
        'mentorship_relationship_id' => null,
    ]);
    $booking->syncOriginal();

    expect($svc->userCanOpenConversation($host, $booking))->toBeTrue()
        ->and($svc->userCanOpenConversation($other, $booking))->toBeFalse();
});
