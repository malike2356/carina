<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Course;
use App\Models\Tenant\Quiz;
use App\Models\Tenant\QuizAttempt;
use App\Models\Tenant\QuizQuestion;
use App\Models\Tenant\User;
use App\Services\Carina\Tools\GetQuizContextTool;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    if (! Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->exists()) {
        $this->artisan('academy:ensure-workspace');
    }
    Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail()->run(function (): void {
        AcademyWorkspace::markAsAcademy();
    });
});

it('hides correct answers in quiz_active mode', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    $tool = app(GetQuizContextTool::class);
    $result = null;

    $academy->run(function () use ($tool, &$result): void {
        $user = User::factory()->create();
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Quiz Course',
            'is_published' => true,
        ]);
        $quiz = Quiz::query()->create(['course_id' => $course->id, 'title' => 'Q']);
        $attempt = QuizAttempt::query()->create(['user_id' => $user->id, 'quiz_id' => $quiz->id]);
        QuizQuestion::query()->create([
            'quiz_id' => $quiz->id,
            'question' => 'Test?',
            'options' => ['A' => 'one', 'B' => 'two'],
            'correct_answer' => ['value' => 'A'],
            'explanation' => 'Because A',
        ]);
        $conversation = CarinaConversation::query()->create([
            'user_id' => $user->id,
            'academy_session_mode' => 'quiz_active',
        ]);
        $result = $tool->execute(['attempt_id' => $attempt->id], $user, $conversation);
    });

    expect($result->success)->toBeTrue();
    expect($result->data)->not->toHaveKey('correct_answer');
    expect(json_encode($result->data))->not->toContain('correct_answer');
});

it('includes correct answers in quiz_review mode', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    $tool = app(GetQuizContextTool::class);
    $result = null;

    $academy->run(function () use ($tool, &$result): void {
        $user = User::factory()->create();
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Quiz Course',
            'is_published' => true,
        ]);
        $quiz = Quiz::query()->create(['course_id' => $course->id, 'title' => 'Q']);
        $attempt = QuizAttempt::query()->create([
            'user_id' => $user->id,
            'quiz_id' => $quiz->id,
            'answers' => [],
            'score' => 50,
            'passed' => false,
            'completed_at' => now(),
        ]);
        QuizQuestion::query()->create([
            'quiz_id' => $quiz->id,
            'question' => 'Test?',
            'options' => ['A' => 'one'],
            'correct_answer' => ['value' => 'A'],
            'explanation' => 'Because A',
        ]);
        $conversation = CarinaConversation::query()->create([
            'user_id' => $user->id,
            'academy_session_mode' => 'quiz_review',
        ]);
        $result = $tool->execute(['attempt_id' => $attempt->id], $user, $conversation);
    });

    expect($result->data['questions'][0]['correct_answer'] ?? null)->toBe('A');
});
