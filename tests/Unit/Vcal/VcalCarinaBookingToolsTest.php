<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalAvailabilityRule;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Carina\Tools\CheckVcalAvailabilityTool;
use App\Services\Carina\Tools\ListVcalEventTypesTool;
use App\Services\Carina\Tools\ScheduleSessionTool;
use App\Services\Tenancy\TenantCreationService;
use Carbon\CarbonImmutable;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('lists active event types for the host', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Tools '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-tools.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->assignRole('tenant_admin');

    VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Strategy call',
        'slug' => 'strategy-call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
    ]);

    $result = app(ListVcalEventTypesTool::class)->execute([], $user, new CarinaConversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['count'])->toBe(1)
        ->and($result->data['event_types'][0]['slug'])->toBe('strategy-call');
});

it('returns availability slots for an event type', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Slots '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-slots.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->assignRole('tenant_admin');

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

    $weekday = CarbonImmutable::now('UTC')->next(CarbonImmutable::MONDAY);
    VcalAvailabilityRule::query()->create([
        'user_id' => $user->id,
        'weekday' => (int) $weekday->dayOfWeek,
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
        'timezone' => 'UTC',
        'is_active' => true,
    ]);

    $result = app(CheckVcalAvailabilityTool::class)->execute([
        'event_type_id' => $type->id,
        'from_date' => $weekday->format('Y-m-d'),
        'days' => 1,
    ], $user, new CarinaConversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['slots'])->not->toBeEmpty();
});

it('schedules a session via Carina and links CRM contact by email', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Book '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-book.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $user->assignRole('tenant_admin');

    $contact = Contact::query()->create([
        'first_name' => 'John',
        'last_name' => 'Investor',
        'email' => 'john@example.test',
        'type' => 'investor',
    ]);

    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Mentoring',
        'slug' => 'mentoring',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
    ]);

    $weekday = CarbonImmutable::now('UTC')->next(CarbonImmutable::TUESDAY);
    VcalAvailabilityRule::query()->create([
        'user_id' => $user->id,
        'weekday' => (int) $weekday->dayOfWeek,
        'starts_at' => '10:00:00',
        'ends_at' => '12:00:00',
        'timezone' => 'UTC',
        'is_active' => true,
    ]);

    $startsAt = $weekday->setTime(10, 0)->utc()->toIso8601String();

    $result = app(ScheduleSessionTool::class)->execute([
        'event_type_slug' => 'mentoring',
        'starts_at' => $startsAt,
        'attendee_name' => 'John Investor',
        'attendee_email' => 'john@example.test',
    ], $user, new CarinaConversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['status'])->toBeIn(['confirmed', 'pending_review'])
        ->and($result->data['contact_id'])->toBe($contact->id);

    $booking = VcalBooking::query()->find($result->data['id']);
    expect($booking?->metadata['source'] ?? null)->toBe('carina_agent');
});
