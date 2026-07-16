<?php

declare(strict_types=1);

use App\Models\Tenant\FireRiskAssessment;
use App\Models\Tenant\FireSafetyDefect;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Compliance\FireRiskAssessmentService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function fraTestTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FRA Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@fra.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

function fraHmoProperty(User $user): Property
{
    return Property::query()->create([
        'address_line1' => '12 Fire Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
}

it('creates a fire risk assessment', function (): void {
    [$tenant, $host, $user] = fraTestTenant();

    tenancy()->initialize($tenant);
    $property = fraHmoProperty($user);

    $assessment = app(FireRiskAssessmentService::class)->createAssessment([
        'property_id' => $property->id,
        'assessment_date' => '2026-01-15',
        'assessor_name' => 'Jane Assessor',
        'assessment_type' => 'type_1_non_destructive',
        'responsible_person_name' => 'John Manager',
        'outcome' => 'satisfactory',
        'review_frequency_months' => 12,
        'created_by_user_id' => $user->id,
        'status' => 'draft',
    ]);

    expect($assessment)->toBeInstanceOf(FireRiskAssessment::class)
        ->and($assessment->next_review_date?->toDateString())->toBe('2027-01-15');

    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/fire-risk-assessments', [
        'property_id' => $property->id,
        'assessment_date' => '2026-02-01',
        'assessor_name' => 'Web Assessor',
        'assessment_type' => 'type_1_non_destructive',
        'responsible_person_name' => 'Web RP',
        'outcome' => 'requires_action',
        'review_frequency_months' => 12,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(FireRiskAssessment::query()->where('assessor_name', 'Web Assessor')->exists())->toBeTrue();
    tenancy()->end();
});

it('adds and remediates a defect', function (): void {
    [$tenant, , $user] = fraTestTenant();

    tenancy()->initialize($tenant);
    $property = fraHmoProperty($user);
    $fra = app(FireRiskAssessmentService::class)->createAssessment([
        'property_id' => $property->id,
        'assessment_date' => now()->toDateString(),
        'assessor_name' => 'Assessor',
        'assessment_type' => 'type_1_non_destructive',
        'responsible_person_name' => 'RP',
        'outcome' => 'requires_action',
        'review_frequency_months' => 12,
        'status' => 'finalised',
    ]);

    $defect = app(FireRiskAssessmentService::class)->addDefect($fra, [
        'defect_type' => 'fire_door',
        'location_description' => 'Kitchen FD30',
        'severity' => 'high',
        'description' => 'Door fails to close fully',
        'found_date' => now()->toDateString(),
        'status' => 'open',
    ]);

    expect($defect->isOpen())->toBeTrue();

    app(FireRiskAssessmentService::class)->remediateDefect(
        $defect,
        Carbon::parse('2026-03-01'),
        'New closer fitted and tested',
    );

    $defect->refresh();
    expect($defect->status)->toBe('remediated')
        ->and($defect->isOpen())->toBeFalse();

    tenancy()->end();
});

it('isReviewDue returns true when next_review_date is past', function (): void {
    [$tenant, , $user] = fraTestTenant();

    tenancy()->initialize($tenant);
    $property = fraHmoProperty($user);

    $past = FireRiskAssessment::query()->create([
        'property_id' => $property->id,
        'assessment_date' => now()->subYear()->toDateString(),
        'assessor_name' => 'A',
        'assessment_type' => 'type_1_non_destructive',
        'responsible_person_name' => 'RP',
        'outcome' => 'satisfactory',
        'next_review_date' => now()->subDays(5)->toDateString(),
        'review_frequency_months' => 12,
        'status' => 'finalised',
    ]);

    $future = FireRiskAssessment::query()->create([
        'property_id' => $property->id,
        'assessment_date' => now()->toDateString(),
        'assessor_name' => 'B',
        'assessment_type' => 'type_1_non_destructive',
        'responsible_person_name' => 'RP',
        'outcome' => 'satisfactory',
        'next_review_date' => now()->addMonths(6)->toDateString(),
        'review_frequency_months' => 12,
        'status' => 'finalised',
    ]);

    expect($past->isReviewDue())->toBeTrue()
        ->and($past->getRagStatus())->toBe('red')
        ->and($future->isReviewDue())->toBeFalse();

    tenancy()->end();
});

it('getPropertiesWithOpenDefects returns correct properties', function (): void {
    [$tenant, , $user] = fraTestTenant();

    tenancy()->initialize($tenant);
    $propertyA = fraHmoProperty($user);
    $propertyB = fraHmoProperty($user);
    $propertyB->update(['address_line1' => '99 Other Road']);

    $fra = app(FireRiskAssessmentService::class)->createAssessment([
        'property_id' => $propertyA->id,
        'assessment_date' => now()->toDateString(),
        'assessor_name' => 'A',
        'assessment_type' => 'type_1_non_destructive',
        'responsible_person_name' => 'RP',
        'outcome' => 'requires_action',
        'review_frequency_months' => 12,
        'status' => 'finalised',
    ]);

    app(FireRiskAssessmentService::class)->addDefect($fra, [
        'defect_type' => 'alarm',
        'location_description' => 'Hall',
        'severity' => 'medium',
        'description' => 'Sounder fault',
        'found_date' => now()->toDateString(),
    ]);

    FireSafetyDefect::query()->create([
        'property_id' => $propertyB->id,
        'defect_type' => 'other',
        'location_description' => 'Loft',
        'severity' => 'low',
        'description' => 'Remediated item',
        'found_date' => now()->toDateString(),
        'status' => 'remediated',
        'remediated_date' => now()->toDateString(),
    ]);

    $withOpen = app(FireRiskAssessmentService::class)->getPropertiesWithOpenDefects();

    expect($withOpen)->toHaveCount(1)
        ->and($withOpen->first()->id)->toBe($propertyA->id);

    tenancy()->end();
});
