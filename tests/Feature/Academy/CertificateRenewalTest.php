<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\Quiz;
use App\Models\Tenant\QuizAttempt;
use App\Models\Tenant\QuizQuestion;
use App\Models\Tenant\User;
use App\Services\Academy\AcademyRenewalService;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    if (Tenant::on('central')->where('slug', AcademyWorkspace::slug())->doesntExist()) {
        $this->artisan('academy:ensure-workspace');
    }
});

it('detects when renewal is required', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    $renewal = app(AcademyRenewalService::class);

    $academy->run(function () use ($renewal): void {
        $assignment = CourseAssignment::query()->create([
            'user_id' => User::factory()->create()->id,
            'course_id' => Course::query()->create([
                'tenant_id' => tenant()->getTenantKey(),
                'name' => 'Renewal Course',
            ])->id,
            'certificate_expires_at' => now()->subDay(),
            'certified_at' => now()->subYear(),
        ]);

        expect($renewal->isRenewalRequired($assignment))->toBeTrue();
    });
});

it('returns five renewal quiz questions', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    $renewal = app(AcademyRenewalService::class);

    $academy->run(function () use ($renewal): void {
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Pool Course',
        ]);
        $quiz = Quiz::query()->create(['course_id' => $course->id, 'title' => 'Q']);
        for ($i = 0; $i < 8; $i++) {
            QuizQuestion::query()->create([
                'quiz_id' => $quiz->id,
                'question' => 'Question '.$i,
                'correct_answer' => ['value' => 'A'],
                'type' => 'multiple_choice',
            ]);
        }

        expect($renewal->renewalQuizQuestions($course, 5))->toHaveCount(5);
    });
});

it('extends certificate on passing renewal', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    $renewal = app(AcademyRenewalService::class);

    $academy->run(function () use ($renewal): void {
        $assignment = CourseAssignment::query()->create([
            'user_id' => User::factory()->create()->id,
            'course_id' => Course::query()->create([
                'tenant_id' => tenant()->getTenantKey(),
                'name' => 'Extend Course',
            ])->id,
            'certified_at' => now()->subYears(2),
            'certificate_expires_at' => now()->subMonth(),
            'renewal_count' => 0,
        ]);

        $quiz = Quiz::query()->create(['course_id' => $assignment->course_id, 'title' => 'Renewal']);
        $attempt = QuizAttempt::query()->create([
            'user_id' => $assignment->user_id,
            'quiz_id' => $quiz->id,
            'passed' => true,
            'score' => 80,
            'completed_at' => now(),
        ]);

        expect($renewal->processRenewal($assignment, $attempt))->toBeTrue();
        $assignment->refresh();
        expect($assignment->renewal_count)->toBe(1);
        expect($assignment->certificate_expires_at?->isFuture())->toBeTrue();
    });
});

it('does not extend certificate when renewal quiz fails', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    $renewal = app(AcademyRenewalService::class);

    $academy->run(function () use ($renewal): void {
        $originalCertified = now()->subYears(2);
        $assignment = CourseAssignment::query()->create([
            'user_id' => User::factory()->create()->id,
            'course_id' => Course::query()->create([
                'tenant_id' => tenant()->getTenantKey(),
                'name' => 'Fail Renew',
            ])->id,
            'certified_at' => $originalCertified,
            'certificate_expires_at' => now()->subMonth(),
            'renewal_count' => 0,
        ]);

        $quiz = Quiz::query()->create(['course_id' => $assignment->course_id, 'title' => 'Renewal fail']);
        $attempt = QuizAttempt::query()->create([
            'user_id' => $assignment->user_id,
            'quiz_id' => $quiz->id,
            'passed' => false,
            'score' => 40,
            'completed_at' => now(),
        ]);

        expect($renewal->processRenewal($assignment, $attempt))->toBeFalse();
        $assignment->refresh();
        expect($assignment->renewal_count)->toBe(0);
        expect($assignment->certified_at->eq($originalCertified))->toBeTrue();
    });
});
