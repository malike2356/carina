<?php

declare(strict_types=1);

use App\Models\Tenant\MentorshipRelationship;
use App\Models\Tenant\User;
use App\Notifications\Tenant\MentorshipMatchApprovedNotification;
use App\Services\MentoringOs\MentorMatchingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Notification;

it('notifies the mentee when a mentor approves a pending match', function (): void {
    Notification::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Match Approve '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@match-approve.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $tid = (string) $tenant->getTenantKey();

    $mentor = User::query()->firstOrFail();
    $mentee = User::factory()->create();

    $rel = MentorshipRelationship::query()->create([
        'tenant_id' => $tid,
        'mentor_id' => $mentor->getKey(),
        'mentee_id' => $mentee->getKey(),
        'status' => 'pending',
    ]);

    app(MentorMatchingService::class)->approveMatch($mentor, $rel->fresh());

    tenancy()->end();

    Notification::assertSentTo($mentee, MentorshipMatchApprovedNotification::class);
});
