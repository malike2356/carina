<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Services\Academy\AcademyCourseBundleService;
use App\Services\CommunityLearning\CourseService;
use App\Support\Academy\AcademyWorkspace;

beforeEach(function (): void {
    if (Tenant::on('central')->where('slug', AcademyWorkspace::slug())->doesntExist()) {
        $this->artisan('academy:ensure-workspace')->assertSuccessful();
    }
});

it('imports and publishes the sample academy bundle', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $academy->run(function (): void {
        Course::query()->whereIn('slug', ['wealth-creation-principles', 'property-investment-beginner-foundations'])->delete();

        $result = app(AcademyCourseBundleService::class)->importFromFile(
            AcademyCourseBundleService::DEFAULT_BUNDLE_PATH,
            publish: true,
        );

        expect($result['imported'])->toBe(2);
        expect($result['published'])->toBe(2);
        expect($result['failed'])->toBe(0);

        $wealth = Course::query()->where('slug', 'wealth-creation-principles')->first();
        expect($wealth)->not->toBeNull();
        expect($wealth->isAcademyPublished())->toBeTrue();
        expect($wealth->status)->toBe('published');
        expect($wealth->modules()->count())->toBe(3);
        expect($wealth->quizzes()->count())->toBe(3);
    });
});

it('exports academy courses to json', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $path = $academy->run(function (): string {
        app(AcademyCourseBundleService::class)->importFromFile(
            AcademyCourseBundleService::DEFAULT_BUNDLE_PATH,
            publish: false,
        );

        return app(AcademyCourseBundleService::class)->exportToFile(
            'storage/app/testing-academy-export.json',
            onlySlugs: ['wealth-creation-principles'],
        );
    });

    $payload = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    expect($payload['course_count'])->toBe(1);
    expect($payload['courses'][0]['slug'])->toBe('wealth-creation-principles');
    expect($payload['courses'][0]['modules'])->toHaveCount(3);

    @unlink($path);
});

it('runs academy import courses artisan command', function (): void {
    $this->artisan('academy:import-courses', [
        'path' => AcademyCourseBundleService::DEFAULT_BUNDLE_PATH,
        '--publish' => true,
        '--force-prod' => true,
    ])->assertSuccessful();

    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    $academy->run(function (): void {
        expect(Course::query()->where('is_published', true)->count())->toBeGreaterThanOrEqual(2);
    });
});

it('publishCourse sets status and is_published together', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $academy->run(function (): void {
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Bundle Publish Test',
            'slug' => 'bundle-publish-test',
            'status' => 'draft',
            'is_published' => false,
        ]);

        $published = app(CourseService::class)->publishCourse($course);

        expect($published->is_published)->toBeTrue();
        expect($published->status)->toBe('published');
    });
});
