<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use Carbon\Carbon;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    Carbon::setTestNow(Carbon::parse('2026-05-04 12:00:00', 'UTC'));
});

afterEach(function (): void {
    Carbon::setTestNow();
});

it('lists and shows bookings on the mobile vcal API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile viCal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-vical.test',
        'plan' => 'starter',
    ]);

    $hostDomain = $tenant->domains->first()->domain.'.propreneur.test';
    $deviceUuid = '22222222-2222-2222-2222-222222222222';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Intro call',
        'slug' => 'intro-call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
    ]);

    $booking = VcalBooking::query()->create([
        'event_type_id' => $type->getKey(),
        'host_user_id' => $user->getKey(),
        'starts_at' => Carbon::parse('2026-05-05 10:00:00', 'UTC'),
        'ends_at' => Carbon::parse('2026-05-05 10:30:00', 'UTC'),
        'attendee_name' => 'Mobile Guest',
        'attendee_email' => 'guest@mobile.test',
        'status' => 'pending_review',
        'carina_brief' => 'Guest looks qualified.',
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $login = $this->postJson('http://'.$hostDomain.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_uuid' => $deviceUuid,
    ]);
    $login->assertOk();
    $token = (string) $login->json('access_token');

    $headers = [
        'Authorization' => 'Bearer '.$token,
        'X-Device-UUID' => $deviceUuid,
    ];

    $list = $this->getJson('http://'.$hostDomain.'/api/v1/mobile/vcal/bookings', $headers);
    $list->assertOk()
        ->assertJsonPath('data.0.attendee_name', 'Mobile Guest')
        ->assertJsonPath('meta.total', 1);

    $show = $this->getJson('http://'.$hostDomain.'/api/v1/mobile/vcal/bookings/'.$booking->getKey(), $headers);
    $show->assertOk()
        ->assertJsonPath('data.carina_brief', 'Guest looks qualified.')
        ->assertJsonPath('data.status', 'pending_review');
});
