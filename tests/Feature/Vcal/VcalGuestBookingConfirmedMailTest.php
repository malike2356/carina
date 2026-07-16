<?php

declare(strict_types=1);

use App\Mail\Vcal\VcalGuestBookingConfirmedMail;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use Carbon\CarbonImmutable;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

function createConfirmedMailFixture(string $locationType = 'google_meet', ?string $joinUrl = null): VcalBooking
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mail ICS '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vcal-mail-ics.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $host = User::query()->firstOrFail();

    $eventType = VcalEventType::query()->create([
        'user_id' => $host->getKey(),
        'name' => 'Strategy Call',
        'slug' => 'strategy-call',
        'duration_minutes' => 60,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'investor_call',
        'is_active' => true,
        'location_type' => $locationType,
    ]);

    return VcalBooking::query()->create([
        'event_type_id' => $eventType->getKey(),
        'host_user_id' => $host->getKey(),
        'starts_at' => CarbonImmutable::parse('2026-07-15 10:00:00', 'UTC'),
        'ends_at' => CarbonImmutable::parse('2026-07-15 11:00:00', 'UTC'),
        'attendee_name' => 'Jane Buyer',
        'attendee_email' => 'jane@buyer.test',
        'status' => 'confirmed',
        'meeting_join_url' => $joinUrl ?? 'https://meet.google.com/abc-xyz',
    ]);
}

it('attaches an ICS file to the confirmed booking email', function (): void {
    $booking = createConfirmedMailFixture();
    $mail = new VcalGuestBookingConfirmedMail($booking);

    $attachments = $mail->attachments();

    expect($attachments)->toHaveCount(1);
    expect((string) $attachments[0]->mime)->toBe('text/calendar');

    tenancy()->end();
});

it('renders provider name in confirmed mail body for google_meet', function (): void {
    $booking = createConfirmedMailFixture('google_meet', 'https://meet.google.com/xyz');
    $mail = new VcalGuestBookingConfirmedMail($booking);

    expect($mail->render())->toContain('Google Meet');

    tenancy()->end();
});

it('renders provider name in confirmed mail body for teams', function (): void {
    $booking = createConfirmedMailFixture('teams', 'https://teams.microsoft.com/l/meetup-join/xxx');
    $mail = new VcalGuestBookingConfirmedMail($booking);

    expect($mail->render())->toContain('Microsoft Teams');

    tenancy()->end();
});

it('renders Zoom as default provider in confirmed mail body', function (): void {
    $booking = createConfirmedMailFixture('zoom', 'https://zoom.us/j/123456');
    $mail = new VcalGuestBookingConfirmedMail($booking);

    expect($mail->render())->toContain('Zoom');

    tenancy()->end();
});
