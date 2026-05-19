<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\AcademyKnowledgeSyncLog;
use App\Models\Tenant\Course;
use App\Models\Tenant\QuizAttempt;
use App\Models\Tenant\User;
use App\Services\Academy\AcademyCarinaGeneratorService;
use App\Services\Academy\AcademySyncCoursesService;
use App\Services\Academy\Dto\GeneratedCourse;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\File;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    if (Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->doesntExist()) {
        $this->artisan('academy:ensure-workspace');
    }
});

function academyTenantForSync(): Tenant
{
    return Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
}

function mockGeneratedCourse(): GeneratedCourse
{
    return new GeneratedCourse(
        title: 'Test Knowledge Course',
        description: 'Learn the basics.',
        category: 'deal-analysis',
        difficulty: 'beginner',
        estimatedMinutes: 45,
        modules: [
            [
                'title' => 'Module 1',
                'content_markdown' => '# Intro',
                'quiz_questions' => [
                    [
                        'question' => 'Q1?',
                        'options' => ['A' => 'Yes', 'B' => 'No', 'C' => 'Maybe', 'D' => 'N/A'],
                        'correct' => 'A',
                        'explanation' => 'Because yes.',
                    ],
                ],
            ],
        ],
    );
}

it('skips unchanged knowledge files on second sync', function (): void {
    $academy = academyTenantForSync();
    $filename = 'sync-test-'.uniqid().'.md';
    $path = rtrim((string) config('paths.brain.knowledge'), '/').'/'.$filename;
    File::put($path, '# Property investor sync test content '.uniqid());

    try {
        $academy->run(function () use ($filename): void {
            $mock = Mockery::mock(AcademyCarinaGeneratorService::class);
            $mock->shouldReceive('generateCourse')->once()->andReturn(mockGeneratedCourse());
            app()->instance(AcademyCarinaGeneratorService::class, $mock);

            $service = app(AcademySyncCoursesService::class);
            $first = $service->sync(onlyFile: $filename);
            expect($first->processed)->toBe(1);

            $second = $service->sync(onlyFile: $filename);
            expect($second->skipped)->toBe(1);
            expect($second->processed)->toBe(0);
        });
    } finally {
        File::delete($path);
    }
});

it('reprocesses unchanged files with force flag', function (): void {
    $academy = academyTenantForSync();
    $filename = 'sync-force-'.uniqid().'.md';
    $path = rtrim((string) config('paths.brain.knowledge'), '/').'/'.$filename;
    File::put($path, '# Property investor force sync '.uniqid());

    try {
        $academy->run(function () use ($filename): void {
            $mock = Mockery::mock(AcademyCarinaGeneratorService::class);
            $mock->shouldReceive('generateCourse')->twice()->andReturn(mockGeneratedCourse());
            app()->instance(AcademyCarinaGeneratorService::class, $mock);

            $service = app(AcademySyncCoursesService::class);
            $service->sync(onlyFile: $filename);
            $forced = $service->sync(force: true, onlyFile: $filename);
            expect($forced->processed)->toBe(1);
        });
    } finally {
        File::delete($path);
    }
});

it('creates courses as draft and dry-run writes nothing', function (): void {
    $academy = academyTenantForSync();
    $filename = 'sync-dry-'.uniqid().'.md';
    $path = rtrim((string) config('paths.brain.knowledge'), '/').'/'.$filename;
    File::put($path, '# Property investor dry run '.uniqid());
    $before = 0;

    try {
        $academy->run(function () use ($filename, &$before): void {
            $before = Course::query()->count();
            $mock = Mockery::mock(AcademyCarinaGeneratorService::class);
            $mock->shouldNotReceive('generateCourse');
            app()->instance(AcademyCarinaGeneratorService::class, $mock);

            $result = app(AcademySyncCoursesService::class)->sync(dryRun: true, onlyFile: $filename);
            expect($result->wouldProcess)->toBe(1);
            expect(Course::query()->count())->toBe($before);
        });

        $academy->run(function () use ($filename): void {
            $mock = Mockery::mock(AcademyCarinaGeneratorService::class);
            $mock->shouldReceive('generateCourse')->once()->andReturn(mockGeneratedCourse());
            app()->instance(AcademyCarinaGeneratorService::class, $mock);

            app(AcademySyncCoursesService::class)->sync(onlyFile: $filename);
            $course = Course::query()->where('source_knowledge_file', $filename)->first();
            expect($course)->not->toBeNull();
            expect($course->status)->toBe('draft');
            expect($course->is_published)->toBeFalse();

            expect(AcademyKnowledgeSyncLog::query()->where('filename', $filename)->exists())->toBeTrue();
        });
    } finally {
        File::delete($path);
    }
});

it('skips system guides instead of generating academy courses', function (): void {
    $academy = academyTenantForSync();
    $filename = 'sync-system-guide-'.uniqid().'.md';
    $path = rtrim((string) config('paths.brain.knowledge'), '/').'/'.$filename;
    File::put($path, "# Tenant Business Page CMS\n\n## Data model\n\n- Model: App\\Models\\Tenant\\BusinessPageSettings\n\n## Routes\n\n| Method | Path | Name |\n\n## Tests\n\nTests/Feature/BusinessPage/BusinessPageTest.php");

    try {
        $academy->run(function () use ($filename): void {
            $mock = Mockery::mock(AcademyCarinaGeneratorService::class);
            $mock->shouldNotReceive('generateCourse');
            app()->instance(AcademyCarinaGeneratorService::class, $mock);

            $result = app(AcademySyncCoursesService::class)->sync(onlyFile: $filename);

            expect($result->skipped)->toBe(1);
            expect(Course::query()->where('source_knowledge_file', $filename)->exists())->toBeFalse();
            expect(AcademyKnowledgeSyncLog::query()
                ->where('filename', $filename)
                ->where('status', 'system_guide')
                ->exists())->toBeTrue();
        });
    } finally {
        File::delete($path);
    }
});

it('continues sync when one file fails', function (): void {
    $academy = academyTenantForSync();
    $ok = 'sync-ok-'.uniqid().'.md';
    $bad = 'sync-bad-'.uniqid().'.md';
    $dir = rtrim((string) config('paths.brain.knowledge'), '/');
    File::put($dir.'/'.$ok, '# Property investor OK');
    File::put($dir.'/'.$bad, '# Property investor Bad');

    try {
        $academy->run(function () use ($ok, $bad): void {
            $mock = Mockery::mock(AcademyCarinaGeneratorService::class);
            $mock->shouldReceive('generateCourse')
                ->with(Mockery::type('string'), $bad)
                ->andThrow(new RuntimeException('Carina failed'));
            $mock->shouldReceive('generateCourse')
                ->with(Mockery::type('string'), $ok)
                ->andReturn(mockGeneratedCourse());
            app()->instance(AcademyCarinaGeneratorService::class, $mock);

            $result = app(AcademySyncCoursesService::class)->sync(onlyFile: $ok);
            $result2 = app(AcademySyncCoursesService::class)->sync(onlyFile: $bad);

            expect($result->processed)->toBe(1);
            expect($result2->failed)->toBe(1);
            expect(Course::query()->where('source_knowledge_file', $ok)->exists())->toBeTrue();
        });
    } finally {
        File::delete([$dir.'/'.$ok, $dir.'/'.$bad]);
    }
});

it('skips sync when in-progress quiz attempts exist', function (): void {
    $academy = academyTenantForSync();
    $filename = 'sync-blocked-'.uniqid().'.md';
    $path = rtrim((string) config('paths.brain.knowledge'), '/').'/'.$filename;
    File::put($path, '# Property investor blocked');

    try {
        $academy->run(function () use ($filename): void {
            $mock = Mockery::mock(AcademyCarinaGeneratorService::class);
            $mock->shouldReceive('generateCourse')->once()->andReturn(mockGeneratedCourse());
            app()->instance(AcademyCarinaGeneratorService::class, $mock);

            $service = app(AcademySyncCoursesService::class);
            $service->sync(onlyFile: $filename);
            $course = Course::query()->where('source_knowledge_file', $filename)->firstOrFail();
            $quizId = $course->quizzes()->value('id');
            QuizAttempt::query()->create([
                'user_id' => User::factory()->create()->id,
                'quiz_id' => $quizId,
                'passed' => false,
            ]);

            File::put(rtrim((string) config('paths.brain.knowledge'), '/').'/'.$filename, '# Property investor blocked updated');
            AcademyKnowledgeSyncLog::query()->where('filename', $filename)->delete();

            $blocked = $service->sync(force: true, onlyFile: $filename);
            expect($blocked->skipped)->toBeGreaterThan(0);
        });
    } finally {
        File::delete($path);
    }
});
