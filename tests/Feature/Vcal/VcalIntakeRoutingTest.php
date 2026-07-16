<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalAvailabilityRule;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Vcal\VcalIntakeRoutingApplicator;
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

it('routes public booking to another event type when intake answer matches', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Routing '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-routing.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $user = User::query()->firstOrFail();
    $user->booking_public_slug = 'routing-host';
    $user->save();

    $screen = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Screen',
        'slug' => 'screen',
        'duration_minutes' => 30,
        'is_active' => true,
        'intake_questions' => [
            ['key' => 'track', 'label' => 'Track', 'type' => 'text', 'required' => true],
        ],
        'intake_routing_rules' => [
            ['when' => ['key' => 'track', 'equals' => 'vip'], 'use_event_type_slug' => 'vip-call'],
        ],
    ]);

    $vip = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'VIP call',
        'slug' => 'vip-call',
        'duration_minutes' => 45,
        'is_active' => true,
    ]);

    foreach ([$screen, $vip] as $type) {
        VcalAvailabilityRule::query()->create([
            'user_id' => $user->id,
            'weekday' => 1,
            'starts_at' => '09:00:00',
            'ends_at' => '17:00:00',
            'timezone' => 'Europe/London',
            'is_active' => true,
        ]);
    }

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $slots = $this->getJson('http://'.$host.'/book/routing-host/slots?event_type_id='.$screen->id.'&from=2026-05-04&days=7');
    $slots->assertOk();
    $firstStart = (string) $slots->json('data.0.starts_at');

    $book = $this->post('http://'.$host.'/book/routing-host', [
        'event_type_id' => $screen->id,
        'starts_at' => $firstStart,
        'attendee_name' => 'VIP Guest',
        'attendee_email' => 'vip@example.com',
        'intake' => ['track' => 'vip'],
    ]);
    $book->assertRedirect();

    tenancy()->initialize($tenant);
    $booking = VcalBooking::query()->where('attendee_email', 'vip@example.com')->first();
    expect($booking)->not->toBeNull();
    expect((int) $booking->event_type_id)->toBe((int) $vip->id);
    tenancy()->end();
});

it('applies routing rules in the intake routing applicator', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Applicator '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-applicator.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $from = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'From',
        'slug' => 'from',
        'duration_minutes' => 30,
        'is_active' => true,
        'intake_routing_rules' => [
            ['when' => ['key' => 'x', 'equals' => 'y'], 'use_event_type_slug' => 'to'],
        ],
    ]);

    $to = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'To',
        'slug' => 'to',
        'duration_minutes' => 30,
        'is_active' => true,
    ]);

    $result = app(VcalIntakeRoutingApplicator::class)->apply($user, $from, ['x' => 'y']);
    expect((int) $result->getKey())->toBe((int) $to->getKey());
    tenancy()->end();
});
