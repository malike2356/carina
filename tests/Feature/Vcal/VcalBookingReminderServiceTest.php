<?php

declare(strict_types=1);

use App\Mail\Vcal\VcalGuestBookingReminderMail;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Vcal\VcalBookingReminderService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\PermissionRegistrar;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('sends a 24h reminder when booking is in the dispatch window', function (): void {
    Mail::fake();

    Carbon::setTestNow(Carbon::parse('2026-05-10 12:00:00', 'UTC'));

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Rem '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rem.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'rem-host';
    $user->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Call',
        'slug' => 'call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
    ]);

    $starts = Carbon::parse('2026-05-11 12:00:00', 'UTC');
    VcalBooking::query()->create([
        'event_type_id' => $type->id,
        'host_user_id' => $user->id,
        'starts_at' => $starts,
        'ends_at' => $starts->copy()->addMinutes(30),
        'attendee_name' => 'Guest',
        'attendee_email' => 'guest-rem@example.test',
        'guest_timezone' => 'UTC',
        'status' => 'confirmed',
    ]);

    $r = app(VcalBookingReminderService::class)->dispatchDueReminders();

    expect($r['24h'])->toBeGreaterThan(0);
    Mail::assertSent(VcalGuestBookingReminderMail::class);

    tenancy()->end();
    Carbon::setTestNow();
});
