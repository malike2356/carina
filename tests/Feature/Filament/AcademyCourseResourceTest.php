<?php

declare(strict_types=1);

use App\Filament\Resources\Academy\CourseResource;
use App\Models\Central\PlatformUser;
use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Services\CommunityLearning\CourseService;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    if (Tenant::on('central')->where('slug', AcademyWorkspace::slug())->doesntExist()) {
        $this->artisan('academy:ensure-workspace');
    }
});

it('publishCourse sets academy status and is_published', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $academy->run(function (): void {
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Filament Publish Test',
            'status' => 'draft',
            'is_published' => false,
        ]);

        $published = app(CourseService::class)->publishCourse($course);

        expect($published->is_published)->toBeTrue();
        expect($published->status)->toBe('published');
        expect($published->isAcademyPublished())->toBeTrue();
    });
});

it('unpublishCourse returns course to draft', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $academy->run(function (): void {
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Filament Unpublish Test',
            'status' => 'published',
            'is_published' => true,
        ]);

        $draft = app(CourseService::class)->unpublishCourse($course);

        expect($draft->is_published)->toBeFalse();
        expect($draft->status)->toBe('draft');
    });
});

it('exposes academy courses in filament when academy workspace is selected', function (): void {
    $admin = PlatformUser::factory()->admin()->create();
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $courseName = 'Filament Visible Course '.uniqid();
    $academy->run(function () use ($courseName): void {
        Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => $courseName,
            'status' => 'draft',
        ]);
    });

    $response = $this->actingAs($admin, 'platform')
        ->withSession(['filament.workspace_id' => $academy->getTenantKey()])
        ->get('/filament/academy/courses');

    $response->assertOk();
    $response->assertSee($courseName, false);
    $response->assertSee('Publish', false);
});

it('exposes academy course create and edit screens with lesson sessions', function (): void {
    $admin = PlatformUser::factory()->admin()->create();
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();

    $course = null;
    $academy->run(function () use (&$course): void {
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Editable Academy Course',
            'slug' => 'editable-academy-course',
            'status' => 'draft',
        ]);

        $course->modules()->create([
            'title' => 'First lesson',
            'content' => 'Lesson content from the admin UI.',
            'sort_order' => 1,
        ]);
    });
    /** @var Course $course */
    $this->actingAs($admin, 'platform')
        ->withSession(['filament.workspace_id' => $academy->getTenantKey()])
        ->get(CourseResource::getUrl('create'))
        ->assertOk()
        ->assertSee('Course details', false)
        ->assertSee('Sessions / lessons', false);

    $this->actingAs($admin, 'platform')
        ->withSession(['filament.workspace_id' => $academy->getTenantKey()])
        ->get(CourseResource::getUrl('edit', ['record' => $course]))
        ->assertOk()
        ->assertSee('Editable Academy Course', false)
        ->assertSee('First lesson', false)
        ->assertSee('Lesson content', false);
});
