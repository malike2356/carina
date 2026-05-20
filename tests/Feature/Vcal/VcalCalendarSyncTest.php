<?php

declare(strict_types=1);

use App\Jobs\Vcal\SyncVcalBookingToCalendarJob;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalAvailabilityRule;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalCalendarConnection;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Vcal\VcalBookingService;
use App\Services\Vcal\VcalCalendarSyncService;
use Carbon\Carbon;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Carbon::setTestNow(Carbon::parse('2026-06-04 10:00:00', 'UTC'));
    $this->withoutMiddleware(VerifyCsrfToken::class);

    Config::set('services.google_calendar.client_id', 'test-google-client');
    Config::set('services.google_calendar.client_secret', 'test-google-secret');
    Config::set('services.microsoft_calendar.client_id', 'test-ms-client');
    Config::set('services.microsoft_calendar.client_secret', 'test-ms-secret');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function enableVcalCalendarSyncForTenant(object $tenant): User
{
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'vcal_calendar_sync')->update(['enabled' => true]);

    return User::query()->firstOrFail();
}

it('creates calendar connection and disconnects', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Cal sync '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vcal-cal.test',
        'plan' => 'starter',
    ]);

    $user = enableVcalCalendarSyncForTenant($tenant);

    $conn = VcalCalendarConnection::query()->create([
        'user_id' => $user->id,
        'provider' => VcalCalendarConnection::PROVIDER_GOOGLE,
        'provider_account_email' => 'host@example.com',
        'calendar_id' => 'primary',
        'sync_enabled' => true,
    ]);
    $conn->setAccessToken('access-token');
    $conn->setRefreshToken('refresh-token');
    $conn->save();

    expect($conn->getAccessToken())->toBe('access-token');

    app(VcalCalendarSyncService::class)->disconnect($conn);
    expect(VcalCalendarConnection::query()->where('user_id', $user->id)->count())->toBe(0);
});

it('dispatches calendar sync job when a booking is confirmed', function (): void {
    Bus::fake([SyncVcalBookingToCalendarJob::class]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Cal job '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vcal-cal-job.test',
        'plan' => 'starter',
    ]);

    $user = enableVcalCalendarSyncForTenant($tenant);
    $user->booking_public_slug = 'cal-host';
    $user->save();

    VcalCalendarConnection::query()->create([
        'user_id' => $user->id,
        'provider' => VcalCalendarConnection::PROVIDER_GOOGLE,
        'provider_account_email' => 'host@example.com',
        'calendar_id' => 'primary',
        'sync_enabled' => true,
    ]);

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Intro',
        'slug' => 'intro',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
        'requires_host_approval' => false,
        'auto_zoom_meeting' => false,
    ]);

    VcalAvailabilityRule::query()->create([
        'user_id' => $user->id,
        'weekday' => 4,
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
        'timezone' => 'UTC',
        'is_active' => true,
    ]);

    completeTenantWorkspaceOnboarding();

    $booking = app(VcalBookingService::class)->createPublicBooking(
        $user,
        $type,
        '2026-06-04T10:00:00+00:00',
        [
            'attendee_name' => 'Guest',
            'attendee_email' => 'guest@example.com',
        ],
        null,
        null,
        false,
    );

    expect($booking->status)->toBe('confirmed');

    Bus::assertDispatched(SyncVcalBookingToCalendarJob::class, function (SyncVcalBookingToCalendarJob $job) use ($booking, $tenant): bool {
        return $job->bookingId === (int) $booking->getKey()
            && $job->tenantId === (string) $tenant->getKey()
            && $job->operation === 'create';
    });
});

it('creates google external event with Http fake', function (): void {
    Http::fake([
        'oauth2.googleapis.com/token' => Http::response([
            'access_token' => 'refreshed-token',
            'expires_in' => 3600,
        ]),
        'www.googleapis.com/calendar/v3/*' => Http::response([
            'id' => 'evt-google-1',
            'htmlLink' => 'https://calendar.google.com/event/1',
        ]),
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Cal API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vcal-cal-api.test',
        'plan' => 'starter',
    ]);

    $user = enableVcalCalendarSyncForTenant($tenant);

    $conn = VcalCalendarConnection::query()->create([
        'user_id' => $user->id,
        'provider' => VcalCalendarConnection::PROVIDER_GOOGLE,
        'provider_account_email' => 'host@example.com',
        'calendar_id' => 'primary',
        'sync_enabled' => true,
        'token_expires_at' => now()->subMinute(),
    ]);
    $conn->setAccessToken('expired-token');
    $conn->setRefreshToken('refresh-token');
    $conn->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Call',
        'slug' => 'call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
        'requires_host_approval' => false,
        'auto_zoom_meeting' => false,
    ]);

    $booking = VcalBooking::query()->create([
        'event_type_id' => $type->id,
        'host_user_id' => $user->id,
        'starts_at' => now()->addDay(),
        'ends_at' => now()->addDay()->addMinutes(30),
        'attendee_name' => 'Guest',
        'attendee_email' => 'guest@example.com',
        'status' => 'confirmed',
    ]);

    app(VcalCalendarSyncService::class)->createExternalEvent($booking);

    $booking->refresh();
    expect($booking->external_calendar_event_id)->toBe('evt-google-1')
        ->and($booking->calendar_sync_attempted)->toBeTrue();

    Http::assertSent(fn ($request) => str_contains($request->url(), 'oauth2.googleapis.com/token'));
    Http::assertSent(fn ($request) => str_contains($request->url(), 'calendars/primary/events'));
});

it('syncs pending rows via syncAllPending', function (): void {
    Http::fake([
        'www.googleapis.com/calendar/v3/*' => Http::response([
            'id' => 'evt-retry-1',
            'htmlLink' => 'https://calendar.google.com/event/retry',
        ]),
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Cal pending '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vcal-pending.test',
        'plan' => 'starter',
    ]);

    $user = enableVcalCalendarSyncForTenant($tenant);

    $conn = VcalCalendarConnection::query()->create([
        'user_id' => $user->id,
        'provider' => VcalCalendarConnection::PROVIDER_GOOGLE,
        'provider_account_email' => 'host@example.com',
        'calendar_id' => 'primary',
        'sync_enabled' => true,
    ]);
    $conn->setAccessToken('valid-token');
    $conn->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Call',
        'slug' => 'call-pending',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
        'requires_host_approval' => false,
        'auto_zoom_meeting' => false,
    ]);

    $booking = VcalBooking::query()->create([
        'event_type_id' => $type->id,
        'host_user_id' => $user->id,
        'starts_at' => now()->addDay(),
        'ends_at' => now()->addDay()->addMinutes(30),
        'attendee_name' => 'Guest',
        'attendee_email' => 'guest@example.com',
        'status' => 'confirmed',
        'calendar_sync_attempted' => false,
    ]);

    app(VcalCalendarSyncService::class)->syncAllPending();

    $booking->refresh();
    expect($booking->external_calendar_event_id)->toBe('evt-retry-1');
});
