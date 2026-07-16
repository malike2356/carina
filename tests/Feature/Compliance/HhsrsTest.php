<?php

declare(strict_types=1);

use App\Models\Tenant\HhsrsAssessment;
use App\Models\Tenant\HhsrsHazardRating;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Compliance\HhsrsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
});

function hhsrsTestContext(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HHSRS '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hhsrs.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '22 Hazard Street',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    return [$tenant, $host, $user, $property];
}

it('creates an assessment with 29 hazard rating rows', function (): void {
    [$tenant, , $user, $property] = hhsrsTestContext();

    tenancy()->initialize($tenant);

    $assessment = app(HhsrsService::class)->createAssessment($property->id, [
        'assessment_date' => '2026-06-01',
        'assessor_type' => 'internal',
        'created_by_user_id' => $user->id,
    ]);

    expect($assessment->hazardRatings)->toHaveCount(29)
        ->and($assessment->hazardRatings->every(fn ($r) => $r->is_present === false))->toBeTrue();

    tenancy()->end();
});

it('computes hazard score correctly', function (): void {
    $rating = new HhsrsHazardRating([
        'is_present' => true,
        'likelihood_score' => 3,
        'harm_outcome_score' => 2,
        'spread_of_harm' => 50,
    ]);

    expect($rating->computeHazardScore())->toBe(450.0);
});

it('returns true from isCategory1 when score is at least 1000', function (): void {
    $rating = new HhsrsHazardRating([
        'is_present' => true,
        'likelihood_score' => 5,
        'harm_outcome_score' => 1,
        'spread_of_harm' => 100,
        'hazard_score' => 15000,
    ]);

    expect($rating->isCategory1())->toBeTrue();

    $low = new HhsrsHazardRating([
        'is_present' => true,
        'likelihood_score' => 3,
        'harm_outcome_score' => 2,
        'spread_of_harm' => 50,
        'hazard_score' => 450,
    ]);

    expect($low->isCategory1())->toBeFalse();
});

it('finaliseAssessment sets overall_outcome to category_1_found when Cat 1 present', function (): void {
    [$tenant, , $user, $property] = hhsrsTestContext();

    tenancy()->initialize($tenant);

    $service = app(HhsrsService::class);
    $assessment = $service->createAssessment($property->id, [
        'assessment_date' => '2026-06-01',
        'assessor_type' => 'internal',
        'created_by_user_id' => $user->id,
    ]);

    foreach ($assessment->hazardRatings as $rating) {
        if ($rating->hazard_code === 'fire') {
            $service->updateHazardRating($rating, [
                'is_present' => true,
                'likelihood_score' => 5,
                'harm_outcome_score' => 1,
                'spread_of_harm' => 100,
            ]);
        } else {
            $service->updateHazardRating($rating, [
                'is_present' => false,
            ]);
        }
    }

    $assessment->refresh()->load('hazardRatings');

    expect($assessment->isFinalisable())->toBeTrue();

    $service->finaliseAssessment($assessment);

    $assessment->refresh();

    expect($assessment->status)->toBe('finalised')
        ->and($assessment->overall_outcome)->toBe('category_1_found')
        ->and($assessment->hasCategory1())->toBeTrue();

    tenancy()->end();
});

it('creates an assessment via HTTP and redirects to show', function (): void {
    [$tenant, $host, $user, $property] = hhsrsTestContext();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/hhsrs', [
        'property_id' => $property->id,
        'assessment_date' => '2026-06-05',
        'assessor_type' => 'internal',
        'assessor_name' => 'Jane Assessor',
    ])->assertRedirect();

    tenancy()->initialize($tenant);

    $assessment = HhsrsAssessment::query()->where('property_id', $property->id)->first();
    expect($assessment)->not->toBeNull()
        ->and($assessment->hazardRatings()->count())->toBe(29);

    tenancy()->end();
});
