<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\Badge;
use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\User;
use App\Models\Tenant\UserBadge;
use App\Services\CommunityLearning\EnrollmentService;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    if (Tenant::on('central')->where('slug', AcademyWorkspace::slug())->doesntExist()) {
        $this->artisan('academy:ensure-workspace');
    }
});

it('awards academy badges on certification', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $academy->run(function (): void {
        $user = User::factory()->create();
        $courses = collect();
        for ($i = 0; $i < 5; $i++) {
            $course = Course::query()->create([
                'tenant_id' => tenant()->getTenantKey(),
                'name' => 'Badge Course '.$i,
                'is_published' => true,
                'status' => 'published',
            ]);
            CourseAssignment::query()->create([
                'user_id' => $user->id,
                'course_id' => $course->id,
                'progress_percent' => 100,
                'enrolled_at' => now(),
            ]);
            $courses->push($course);
        }

        $enrollment = app(EnrollmentService::class);
        foreach ($courses as $course) {
            $enrollment->certify($user, $course);
        }

        $badgeNames = Badge::query()->pluck('name')->all();
        expect($badgeNames)->toContain('academy-first-course');
        expect($badgeNames)->toContain('academy-scholar');

        expect(UserBadge::query()->where('user_id', $user->id)->count())->toBeGreaterThanOrEqual(2);
    });
});
