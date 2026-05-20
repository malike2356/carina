<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\Course;
use App\Models\Tenant\CourseAssignment;
use App\Models\Tenant\User;
use App\Services\Academy\AcademyCertificateVerificationService;
use App\Support\Academy\AcademyWorkspace;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    if (Tenant::on('central')->where('slug', AcademyWorkspace::slug())->doesntExist()) {
        $this->artisan('academy:ensure-workspace');
    }
    // Clean up any leftover test records from previous runs
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->first();
    if ($academy) {
        $academy->run(function (): void {
            CourseAssignment::query()
                ->whereIn('certificate_code', ['CERT-UNIT-TEST-ABCD1234', 'CERT-EXPIRED-UNIT-TEST'])
                ->delete();
        });
    }
});

it('masks holder name for privacy', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    $service = app(AcademyCertificateVerificationService::class);
    $code = 'CERT-UNIT-TEST-ABCD1234';

    $academy->run(function () use ($service, $code): void {
        $user = User::factory()->create(['name' => 'John Doe']);
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Unit Course',
        ]);
        CourseAssignment::query()->create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'certificate_code' => $code,
            'certified_at' => now(),
            'certificate_expires_at' => now()->addYear(),
        ]);

        $result = $service->verify($code);
        expect($result['holder'])->toBe('John D.');
        expect($result['status'])->toBe('valid');
    });
});

it('reports expired status', function (): void {
    $academy = Tenant::on('central')->where('slug', AcademyWorkspace::slug())->firstOrFail();
    $service = app(AcademyCertificateVerificationService::class);
    $code = 'CERT-EXPIRED-UNIT-TEST';

    $academy->run(function () use ($service, $code): void {
        $user = User::factory()->create(['name' => 'Jane Smith']);
        $course = Course::query()->create([
            'tenant_id' => tenant()->getTenantKey(),
            'name' => 'Expired Course',
        ]);
        CourseAssignment::query()->create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'certificate_code' => $code,
            'certified_at' => now()->subYears(2),
            'certificate_expires_at' => now()->subDay(),
        ]);

        expect($service->verify($code)['status'])->toBe('expired');
    });
});
