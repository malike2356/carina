<?php

declare(strict_types=1);

use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\MentorshipCarinaAlert;
use App\Models\Tenant\MentorshipPackage;
use App\Models\Tenant\MentorshipProgrammeCarinaSettings;
use App\Services\Mentoring\MentoringAlertService;
use Database\Seeders\Central\FeatureFlagSeeder;

require_once __DIR__.'/MentorAssistantTestHelpers.php';

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    mentorAssistantBootstrapFlags();
});

afterEach(function (): void {
    if (tenancy()->initialized) {
        tenancy()->end();
    }
});

it('fires module_stalled alert after inactivity threshold', function (): void {
    $s = mentorAssistantScenario();
    tenancy()->initialize($s['tenant']);

    MentorshipProgrammeCarinaSettings::query()->create([
        'mentorship_programme_id' => $s['programme']->id,
        'alert_stall_days' => 2,
    ]);

    $course = Course::query()->create([
        'tenant_id' => $s['tid'],
        'name' => 'Module 1',
        'slug' => 'mod-1-'.uniqid(),
        'is_published' => true,
    ]);

    $package = MentorshipPackage::query()->create([
        'tenant_id' => $s['tid'],
        'mentorship_programme_id' => $s['programme']->id,
        'mentor_id' => $s['mentor']->id,
        'name' => 'Pack',
        'slug' => 'pack-'.uniqid(),
        'price_cents' => 1000,
        'currency' => 'GBP',
        'is_active' => true,
    ]);
    $package->courses()->attach($course->id);

    CourseAssignment::query()->create([
        'user_id' => $s['mentee']->id,
        'course_id' => $course->id,
        'progress_percent' => 10,
        'enrolled_at' => now()->subDays(10),
    ]);

    app(MentoringAlertService::class)->evaluateAll();

    $alert = MentorshipCarinaAlert::query()
        ->where('alert_type', 'module_stalled')
        ->where('student_user_id', $s['mentee']->id)
        ->first();

    expect($alert)->not->toBeNull();
    tenancy()->end();
});

it('fires module_completed via alert service', function (): void {
    $s = mentorAssistantScenario();
    tenancy()->initialize($s['tenant']);

    $course = Course::query()->create([
        'tenant_id' => $s['tid'],
        'name' => 'Done module',
        'slug' => 'done-'.uniqid(),
        'is_published' => true,
    ]);

    app(MentoringAlertService::class)->fireModuleCompleted(
        $s['relationship'],
        (int) $s['mentee']->id,
        (int) $s['programme']->id,
        $course,
        85,
    );

    expect(MentorshipCarinaAlert::query()->where('alert_type', 'module_completed')->exists())->toBeTrue();
    tenancy()->end();
});
