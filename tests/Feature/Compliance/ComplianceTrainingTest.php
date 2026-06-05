<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceStaffTraining;
use App\Models\Tenant\ComplianceTrainingCategory;
use App\Models\Tenant\ComplianceTrainingCourse;
use App\Models\Tenant\User;
use App\Services\Compliance\ComplianceTrainingService;
use App\Services\Tenancy\TenantCreationService;
use Carbon\Carbon;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function createComplianceTrainingCourse(array $overrides = []): ComplianceTrainingCourse
{
    $category = ComplianceTrainingCategory::query()->first()
        ?? ComplianceTrainingCategory::query()->create([
            'name' => 'Test Category',
            'is_active' => true,
            'sort_order' => 0,
        ]);

    return ComplianceTrainingCourse::query()->create(array_merge([
        'compliance_training_category_id' => $category->id,
        'title' => 'AML Awareness',
        'is_mandatory' => true,
        'validity_months' => 12,
        'is_active' => true,
        'version' => '1.0',
    ], $overrides));
}

it('enrols a user on a course', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Training '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-training.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $course = createComplianceTrainingCourse();

    $enrollment = app(ComplianceTrainingService::class)->enrolUser(
        (int) $user->id,
        (int) $course->id,
        Carbon::parse('2026-12-31'),
        (int) $user->id,
    );

    expect($enrollment)->toBeInstanceOf(ComplianceStaffTraining::class)
        ->and($enrollment->user_id)->toBe($user->id)
        ->and($enrollment->compliance_training_course_id)->toBe($course->id)
        ->and($enrollment->due_date?->toDateString())->toBe('2026-12-31');

    tenancy()->end();
});

it('sets passed and expiry_date when completing with score at least 70', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Complete '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-complete.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $course = createComplianceTrainingCourse(['validity_months' => 12]);
    $svc = app(ComplianceTrainingService::class);
    $enrollment = $svc->enrolUser((int) $user->id, (int) $course->id);

    Carbon::setTestNow('2026-06-05 12:00:00');
    $svc->recordCompletion($enrollment, 85, 'https://example.com/cert.pdf');
    $enrollment->refresh();

    expect($enrollment->passed)->toBeTrue()
        ->and($enrollment->score)->toBe(85)
        ->and($enrollment->completed_at)->not->toBeNull()
        ->and($enrollment->expiry_date?->toDateString())->toBe('2027-06-05');

    Carbon::setTestNow();
    tenancy()->end();
});

it('reports isExpired when expiry_date is in the past', function (): void {
    $enrollment = new ComplianceStaffTraining([
        'expiry_date' => now()->subDay()->toDateString(),
        'completed_at' => now()->subMonths(13),
        'passed' => true,
    ]);

    expect($enrollment->isExpired())->toBeTrue();
});

it('returns red rag status for expired enrollment', function (): void {
    $enrollment = new ComplianceStaffTraining([
        'expiry_date' => now()->subDay()->toDateString(),
        'completed_at' => now()->subMonths(13),
        'passed' => true,
    ]);

    expect($enrollment->getRagStatus())->toBe('red');
});

it('returns mandatory courses not completed for a user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Mandatory '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-mandatory.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $svc = app(ComplianceTrainingService::class);

    $mandatoryA = createComplianceTrainingCourse(['title' => 'Fire Safety', 'is_mandatory' => true]);
    $mandatoryB = createComplianceTrainingCourse(['title' => 'GDPR Basics', 'is_mandatory' => true]);
    createComplianceTrainingCourse(['title' => 'Optional Reading', 'is_mandatory' => false]);

    $enrollment = $svc->enrolUser((int) $user->id, (int) $mandatoryA->id);
    $svc->recordCompletion($enrollment, 90);

    $missing = $svc->getMandatoryCoursesNotCompleted((int) $user->id);

    expect($missing)->toHaveCount(1)
        ->and($missing->first()->id)->toBe($mandatoryB->id);

    tenancy()->end();
});
