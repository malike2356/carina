<?php

declare(strict_types=1);

use App\Mail\Vcal\VcalGuestBookingCancelledMail;
use App\Mail\Vcal\VcalGuestBookingReceivedMail;
use App\Mail\Vcal\VcalGuestBookingRescheduledMail;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Vcal\VcalBookingNotifier;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('sends lifecycle mails for received, cancelled, and rescheduled', function (): void {
    Mail::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mail '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-mail.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'mail-host';
    $user->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Call',
        'slug' => 'call',
        'duration_minutes' => 30,
        'is_active' => true,
        'cancellation_window_hours' => 48,
    ]);

    $booking = VcalBooking::query()->create([
        'event_type_id' => $type->id,
        'host_user_id' => $user->id,
        'starts_at' => now()->addDays(3),
        'ends_at' => now()->addDays(3)->addMinutes(30),
        'attendee_name' => 'Guest',
        'attendee_email' => 'guest@example.com',
        'status' => 'pending_review',
    ]);

    $thanks = 'https://example.test/thanks';

    $notifier = app(VcalBookingNotifier::class);
    $notifier->notifyGuestReceived($booking, $thanks);
    $notifier->notifyGuestCancelled($booking, $thanks);
    $notifier->notifyGuestRescheduled($booking, $thanks);

    Mail::assertSent(VcalGuestBookingReceivedMail::class);
    Mail::assertSent(VcalGuestBookingCancelledMail::class);
    Mail::assertSent(VcalGuestBookingRescheduledMail::class);
    tenancy()->end();
});
