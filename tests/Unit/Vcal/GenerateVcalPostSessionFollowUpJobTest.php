<?php

declare(strict_types=1);

use App\Jobs\Vcal\GenerateVcalPostSessionFollowUpJob;
use App\Mail\Vcal\VcalGuestCarinaPostSessionMail;
use App\Models\Tenant\User;
use App\Models\Tenant\Vcal\VcalBooking;
use App\Models\Tenant\Vcal\VcalEventType;
use App\Services\Carina\CarinaService;
use App\Services\Tenancy\TenantCreationService;
use App\Services\Vcal\VcalCarinaFollowUpService;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('stores post-session note and sends email when outcome is attended', function (): void {
    Mail::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Post Session '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@vical-post.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $type = VcalEventType::query()->create([
        'user_id' => $user->id,
        'name' => 'Review',
        'slug' => 'review',
        'duration_minutes' => 30,
        'buffer_before_minutes' => 0,
        'buffer_after_minutes' => 0,
        'kind' => 'custom',
        'is_active' => true,
    ]);

    $booking = VcalBooking::query()->create([
        'event_type_id' => $type->getKey(),
        'host_user_id' => $user->getKey(),
        'starts_at' => now()->subHour(),
        'ends_at' => now()->subMinutes(30),
        'attendee_name' => 'Sam Guest',
        'attendee_email' => 'sam@example.test',
        'status' => 'confirmed',
        'session_outcome' => 'attended',
    ]);

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('complete')
            ->once()
            ->andReturn('Great session. Book a follow-up to discuss HMO licensing next.');
    });

    $job = new GenerateVcalPostSessionFollowUpJob((int) $booking->getKey(), (string) $tenant->getTenantKey());
    $job->handle(app(CarinaService::class), app(VcalCarinaFollowUpService::class));

    expect($booking->fresh()->carina_post_session_note)->toContain('Great session');
    Mail::assertSent(VcalGuestCarinaPostSessionMail::class);
});
