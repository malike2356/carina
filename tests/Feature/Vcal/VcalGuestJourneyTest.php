<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalAvailabilityRule;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow(Carbon::parse('2026-05-04 12:00:00', 'UTC'));
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

afterEach(function (): void {
    Carbon::setTestNow();
});

it('serves calendar summaries, ics, guest cancel, and guest reschedule', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Guest Journey '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-guest.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'guest-host';
    $user->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Strategy call',
        'slug' => 'strategy-call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
        'cancellation_window_hours' => 48,
    ]);

    VcalAvailabilityRule::query()->create([
        'user_id' => $user->id,
        'weekday' => 1,
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
        'timezone' => 'Europe/London',
        'is_active' => true,
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $calendar = $this->getJson('http://'.$host.'/book/guest-host/calendar?event_type_id='.$type->id.'&year=2026&month=5&timezone=Europe/London');
    $calendar->assertOk();
    expect($calendar->json('data.days'))->not->toBeEmpty();

    $slots = $this->getJson('http://'.$host.'/book/guest-host/slots?event_type_id='.$type->id.'&from=2026-05-04&days=7');
    $slots->assertOk();
    $firstStart = (string) $slots->json('data.0.starts_at');

    $book = $this->post('http://'.$host.'/book/guest-host', [
        'event_type_id' => $type->id,
        'starts_at' => $firstStart,
        'attendee_name' => 'Guest',
        'attendee_email' => 'guest@example.test',
        'guest_timezone' => 'Europe/London',
    ]);
    $book->assertRedirect();

    tenancy()->initialize($tenant);
    $booking = VcalBooking::query()->firstOrFail();
    expect($booking->guest_timezone)->toBe('Europe/London');
    tenancy()->end();

    $ics = $this->get('http://'.$host.'/book/guest-host/thanks/'.$booking->public_token.'/ics');
    $ics->assertOk();
    expect($ics->headers->get('content-type'))->toContain('text/calendar');
    expect($ics->getContent())->toContain('BEGIN:VCALENDAR');

    $rescheduleSlots = $this->getJson('http://'.$host.'/book/guest-host/slots?event_type_id='.$type->id.'&from=2026-05-11&days=7');
    $rescheduleSlots->assertOk();
    $newStart = (string) $rescheduleSlots->json('data.0.starts_at');

    $reschedule = $this->post('http://'.$host.'/book/guest-host/booking/'.$booking->public_token.'/reschedule', [
        'starts_at' => $newStart,
    ]);
    $reschedule->assertRedirect();

    tenancy()->initialize($tenant);
    $booking->refresh();
    expect($booking->starts_at?->toIso8601String())->toBe(Carbon::parse($newStart)->utc()->toIso8601String());
    tenancy()->end();

    $cancel = $this->post('http://'.$host.'/book/guest-host/booking/'.$booking->public_token.'/cancel');
    $cancel->assertRedirect();

    tenancy()->initialize($tenant);
    expect($booking->fresh()->status)->toBe('cancelled');
    tenancy()->end();
});
