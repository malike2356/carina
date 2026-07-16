<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\LearningPath;
use App\Models\Tenant\LearningPathAssignment;
use App\Models\Tenant\MentorshipRelationship;
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

it('validates mentorship and learning path anchors on viCal API bookings', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Anchor '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-anchor.test',
        'plan' => 'starter',
    ]);

    $hostDomain = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);

    $tid = (string) $tenant->getTenantKey();
    $mentor = User::query()->firstOrFail();
    $mentor->booking_public_slug = 'mentor-slug';
    $mentor->save();

    $menteeB = User::factory()->create([
        'email' => 'mentee-b-'.uniqid().'@vical-anchor.test',
        'name' => 'Mentee B',
    ]);
    $menteeC = User::factory()->create([
        'email' => 'mentee-c-'.uniqid().'@vical-anchor.test',
        'name' => 'Mentee C',
    ]);

    $relAb = MentorshipRelationship::query()->create([
        'tenant_id' => $tid,
        'mentor_id' => $mentor->getKey(),
        'mentee_id' => $menteeB->getKey(),
        'status' => 'active',
        'started_at' => now(),
    ]);

    $relAc = MentorshipRelationship::query()->create([
        'tenant_id' => $tid,
        'mentor_id' => $mentor->getKey(),
        'mentee_id' => $menteeC->getKey(),
        'status' => 'active',
        'started_at' => now(),
    ]);

    $path = LearningPath::query()->create([
        'tenant_id' => $tid,
        'name' => 'Starter path',
        'description' => null,
        'courses' => [],
        'is_published' => true,
    ]);

    $assignmentForB = LearningPathAssignment::query()->create([
        'user_id' => $menteeB->getKey(),
        'learning_path_id' => $path->getKey(),
        'started_at' => now(),
        'progress_percent' => 0,
    ]);

    $type = VcalEventType::query()->create([
        'user_id' => $mentor->getKey(),
        'name' => 'Mentor session',
        'slug' => 'mentor-session',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'mentorship',
        'is_active' => true,
        'allowed_booking_contexts' => ['mentorship', 'learning_path'],
    ]);

    VcalAvailabilityRule::query()->create([
        'user_id' => $mentor->getKey(),
        'weekday' => 1,
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
        'timezone' => 'Europe/London',
        'is_active' => true,
    ]);

    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($mentor, 'web');

    $ok = $this->postJson('http://'.$hostDomain.'/api/vcal/bookings', [
        'event_type_id' => $type->getKey(),
        'starts_at' => '2026-05-04T14:00:00Z',
        'attendee_name' => 'Mentee B',
        'attendee_email' => $menteeB->email,
        'mentorship_relationship_id' => $relAb->getKey(),
        'learning_path_assignment_id' => $assignmentForB->getKey(),
    ]);
    $ok->assertCreated();

    tenancy()->initialize($tenant);
    $booking = VcalBooking::query()->orderByDesc('id')->first();
    expect($booking)->not->toBeNull()
        ->and((int) $booking->mentorship_relationship_id)->toBe((int) $relAb->getKey())
        ->and((int) $booking->learning_path_assignment_id)->toBe((int) $assignmentForB->getKey());

    $type->refresh();
    $type->update(['allowed_booking_contexts' => ['learning_path']]);
    tenancy()->end();

    $blocked = $this->postJson('http://'.$hostDomain.'/api/vcal/bookings', [
        'event_type_id' => $type->getKey(),
        'starts_at' => '2026-05-04T15:00:00Z',
        'attendee_name' => 'Mentee B',
        'attendee_email' => $menteeB->email,
        'mentorship_relationship_id' => $relAb->getKey(),
    ]);
    $blocked->assertStatus(422);
    expect($blocked->json('message'))->toContain('mentorship');

    tenancy()->initialize($tenant);
    $type->refresh();
    $type->update(['allowed_booking_contexts' => ['mentorship', 'learning_path']]);
    tenancy()->end();

    $incoherent = $this->postJson('http://'.$hostDomain.'/api/vcal/bookings', [
        'event_type_id' => $type->getKey(),
        'starts_at' => '2026-05-04T16:00:00Z',
        'attendee_name' => 'Mentee B',
        'attendee_email' => $menteeB->email,
        'mentorship_relationship_id' => $relAc->getKey(),
        'learning_path_assignment_id' => $assignmentForB->getKey(),
    ]);
    $incoherent->assertStatus(422);
    expect($incoherent->json('message'))->toContain('mentor or mentee');
});

it('lets mentor or mentee open Carina from a viCal booking linked to their mentorship', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'viCal Carina '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-carina.test',
        'plan' => 'starter',
    ]);

    $hostDomain = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'booking_calendar')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);

    $tid = (string) $tenant->getTenantKey();
    $mentor = User::query()->firstOrFail();
    $mentee = User::factory()->create([
        'email' => 'mentee-open-'.uniqid().'@vical-carina.test',
        'name' => 'Mentee Open',
    ]);

    $rel = MentorshipRelationship::query()->create([
        'tenant_id' => $tid,
        'mentor_id' => $mentor->getKey(),
        'mentee_id' => $mentee->getKey(),
        'status' => 'active',
        'started_at' => now(),
    ]);

    $type = VcalEventType::query()->create([
        'user_id' => $mentor->getKey(),
        'name' => 'Coaching',
        'slug' => 'coaching',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'mentorship',
        'is_active' => true,
        'allowed_booking_contexts' => ['mentorship'],
    ]);

    VcalAvailabilityRule::query()->create([
        'user_id' => $mentor->getKey(),
        'weekday' => 1,
        'starts_at' => '09:00:00',
        'ends_at' => '17:00:00',
        'timezone' => 'Europe/London',
        'is_active' => true,
    ]);

    completeTenantWorkspaceOnboarding();

    $booking = VcalBooking::query()->create([
        'event_type_id' => $type->getKey(),
        'host_user_id' => $mentor->getKey(),
        'mentorship_relationship_id' => $rel->getKey(),
        'starts_at' => now()->addHour(),
        'ends_at' => now()->addHour()->addMinutes(30),
        'attendee_name' => 'Mentee Open',
        'attendee_email' => $mentee->email,
        'status' => 'confirmed',
    ]);

    $bookingId = (int) $booking->getKey();

    $stranger = User::factory()->create([
        'email' => 'stranger-'.uniqid().'@vical-carina.test',
        'name' => 'Stranger',
    ]);

    tenancy()->end();

    $this->actingAs($mentee, 'web')
        ->get('http://'.$hostDomain.'/carina/open-booking/'.$bookingId)
        ->assertRedirect();

    $this->actingAs($mentor, 'web')
        ->get('http://'.$hostDomain.'/carina/open-booking/'.$bookingId)
        ->assertRedirect();

    $this->actingAs($stranger, 'web')
        ->get('http://'.$hostDomain.'/carina/open-booking/'.$bookingId)
        ->assertForbidden();
});
