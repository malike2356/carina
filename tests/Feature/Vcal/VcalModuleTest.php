<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
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

it('exposes viCal API, public booking page, slots, booking flow, and Carina open-booking', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'demo-host';
    $user->save();

    VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Investor call',
        'slug' => 'investor-call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'investor_call',
        'is_active' => true,
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

    $this->actingAs($user, 'web');

    $types = $this->getJson('http://'.$host.'/api/vcal/event-types');
    $types->assertOk();
    expect($types->json('data'))->toHaveCount(1);

    $public = $this->get('http://'.$host.'/book/demo-host');
    $public->assertOk();

    $typeId = (int) $types->json('data.0.id');
    $slots = $this->getJson('http://'.$host.'/book/demo-host/slots?event_type_id='.$typeId.'&from=2026-05-04&days=7');
    $slots->assertOk();
    expect($slots->json('data'))->not->toBeEmpty();

    $firstStart = (string) $slots->json('data.0.starts_at');

    $book = $this->post('http://'.$host.'/book/demo-host', [
        'event_type_id' => $typeId,
        'starts_at' => $firstStart,
        'attendee_name' => 'Guest Investor',
        'attendee_email' => 'guest@example.test',
    ]);
    $book->assertRedirect();

    tenancy()->initialize($tenant);
    $booking = VcalBooking::query()->firstOrFail();
    expect($booking->attendee_email)->toBe('guest@example.test');
    expect($booking->status)->toBe('confirmed');
    tenancy()->end();

    $carina = $this->get('http://'.$host.'/carina/open-booking/'.$booking->getKey());
    $carina->assertRedirect();
    $target = $carina->headers->get('Location');
    expect($target)->toContain('/carina/conversations/');

    tenancy()->initialize($tenant);
    $conv = CarinaConversation::query()->latest('id')->first();
    expect($conv)->not->toBeNull();
    expect($conv->context_type)->toBe('vcal_booking');
    expect((int) $conv->context_id)->toBe((int) $booking->getKey());
    tenancy()->end();
});
