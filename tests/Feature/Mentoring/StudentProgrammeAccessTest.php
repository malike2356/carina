<?php

declare(strict_types=1);

use App\Models\Tenant\MentorshipProgramme;
use App\Models\Tenant\MentorshipRelationship;
use App\Models\Tenant\User;
use App\Services\Mentoring\MentorshipProgrammeAccessService;
use Database\Seeders\Central\FeatureFlagSeeder;

require_once __DIR__.'/MentorAssistantTestHelpers.php';

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    mentorAssistantBootstrapFlags();
});

it('allows enrolled mentee programme access via service', function (): void {
    $s = mentorAssistantScenario();

    tenancy()->initialize($s['tenant']);
    $mentee = User::query()->findOrFail($s['mentee']->id);
    $programme = MentorshipProgramme::query()->findOrFail($s['programmeId']);

    expect(app(MentorshipProgrammeAccessService::class)->userCanAccessProgramme($mentee, $programme))
        ->toBeTrue();
    tenancy()->end();
});

it('shows an empty programme list instead of forbidding non mentees', function (): void {
    $s = mentorAssistantWorkspace();

    tenancy()->initialize($s['tenant']);
    $admin = User::factory()->create();
    $admin->assignRole('tenant_admin');
    completeTenantWorkspaceOnboarding();
    tenancy()->end();
    mentorAssistantEnableFlagsForTenant($s['tid']);

    mentorAssistantGetAs($admin, $s['host'], '/my-programme', $s['tenant'])
        ->assertOk()
        ->assertSee('You are not enrolled in any active programmes yet.', false);
});

it('denies stranger programme access via service', function (): void {
    $s = mentorAssistantScenario();

    tenancy()->initialize($s['tenant']);
    $stranger = User::factory()->create();
    $stranger->assignRole('mentee');
    $programme = MentorshipProgramme::query()->findOrFail($s['programmeId']);

    expect(app(MentorshipProgrammeAccessService::class)->userCanAccessProgramme($stranger, $programme))
        ->toBeFalse();
    tenancy()->end();
});

it('denies mentee from acting as programme mentor', function (): void {
    $s = mentorAssistantScenario();

    tenancy()->initialize($s['tenant']);
    $mentee = User::query()->findOrFail($s['mentee']->id);

    $isMentor = MentorshipRelationship::query()
        ->where('mentorship_programme_id', $s['programmeId'])
        ->where('mentor_id', $mentee->id)
        ->exists();

    expect($isMentor)->toBeFalse();
    tenancy()->end();
});
