<?php

declare(strict_types=1);

use App\Jobs\Vcal\GenerateVcalPendingReviewBriefJob;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Carina\CarinaService;
use App\Services\Tenancy\TenantCreationService;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('stores a Carina brief using attendee_name for pending_review bookings', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Brief Job '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-brief.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Review call',
        'slug' => 'review-call',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
        'requires_host_approval' => true,
    ]);

    $booking = VcalBooking::query()->create([
        'event_type_id' => $type->getKey(),
        'host_user_id' => $user->getKey(),
        'starts_at' => now()->addDay(),
        'ends_at' => now()->addDay()->addMinutes(30),
        'attendee_name' => 'Pat Investor',
        'attendee_email' => 'pat@example.test',
        'status' => 'pending_review',
    ]);

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('complete')
            ->once()
            ->withArgs(function (string $userMessage): bool {
                return str_contains($userMessage, 'Pat Investor');
            })
            ->andReturn('Approve: strong fit for portfolio review.');
    });

    $job = new GenerateVcalPendingReviewBriefJob((int) $booking->getKey(), (string) $tenant->getTenantKey());
    $job->handle(app(CarinaService::class));

    expect($booking->fresh()->carina_brief)->toBe('Approve: strong fit for portfolio review.');
});
