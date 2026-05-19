<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\User;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    if (Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->doesntExist()) {
        $this->artisan('academy:ensure-workspace');
    }
});

it('verifies certificate without auth', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::SLUG)->firstOrFail();
    $host = $academy->domains->first()->domain.'.propreneur.test';
    $code = 'CERT-TEST-ABCDEF12';

    $academy->run(function () use ($code): void {
        $user = User::factory()->create(['name' => 'John Doe']);
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Test Course',
            'is_published' => true,
            'status' => 'published',
        ]);
        CourseAssignment::query()->create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'certificate_code' => $code,
            'certified_at' => now()->subMonths(6),
            'certificate_expires_at' => now()->addMonths(6),
            'progress_percent' => 100,
        ]);
    });

    $this->get("http://{$host}/certificates/verify/{$code}")
        ->assertOk()
        ->assertSee('Valid certificate')
        ->assertSee('John D.')
        ->assertDontSee('John Doe');
});
