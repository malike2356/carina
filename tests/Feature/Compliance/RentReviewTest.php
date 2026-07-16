<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\RentReview;
use App\Models\Tenant\TenancyAgreement;
use App\Models\Tenant\User;
use App\Services\Compliance\RentReviewService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function rentReviewTestContext(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Rent Review '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rent-review.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '22 Review Road',
        'city' => 'Manchester',
        'postcode' => 'M1 2AB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    return [$tenant, $host, $user, $property];
}

it('creates a rent review with increase percent auto-computed', function (): void {
    [, , , $property] = rentReviewTestContext();

    $review = app(RentReviewService::class)->createReview([
        'property_id' => $property->id,
        'review_type' => 'section_13',
        'current_rent_pcm' => 1000,
        'proposed_rent_pcm' => 1100,
        'notice_period_days' => 30,
    ]);

    expect((float) $review->proposed_increase_percent)->toBe(10.0);

    tenancy()->end();
});

it('serveNotice sets status to notice_served', function (): void {
    [, , , $property] = rentReviewTestContext();

    $review = app(RentReviewService::class)->createReview([
        'property_id' => $property->id,
        'review_type' => 'section_13',
        'current_rent_pcm' => 900,
        'proposed_rent_pcm' => 950,
        'notice_period_days' => 30,
    ]);

    app(RentReviewService::class)->serveNotice($review, Carbon::parse('2026-06-01'), 'post');

    $review->refresh();

    expect($review->status)->toBe('notice_served')
        ->and($review->notice_date?->toDateString())->toBe('2026-06-01')
        ->and($review->valid_from_date?->toDateString())->toBe('2026-07-01')
        ->and($review->delivery_method)->toBe('post');

    tenancy()->end();
});

it('recordTenantResponse with challenged sets tenant_response correctly', function (): void {
    [, , , $property] = rentReviewTestContext();

    $review = app(RentReviewService::class)->createReview([
        'property_id' => $property->id,
        'review_type' => 'section_13',
        'current_rent_pcm' => 800,
        'proposed_rent_pcm' => 850,
    ]);

    app(RentReviewService::class)->serveNotice($review, Carbon::parse('2026-06-01'), 'hand');
    app(RentReviewService::class)->recordTenantResponse($review, 'challenged', Carbon::parse('2026-06-15'));

    $review->refresh();

    expect($review->tenant_response)->toBe('challenged')
        ->and($review->tenant_response_date?->toDateString())->toBe('2026-06-15')
        ->and($review->status)->toBe('tenant_responded');

    tenancy()->end();
});

it('canBeTribunalReferred returns true only when response is challenged and not referred', function (): void {
    $review = new RentReview([
        'tenant_response' => 'challenged',
        'tribunal_referred' => false,
    ]);

    expect($review->canBeTribunalReferred())->toBeTrue();

    $review->tribunal_referred = true;
    expect($review->canBeTribunalReferred())->toBeFalse();

    $review->tribunal_referred = false;
    $review->tenant_response = 'accepted';
    expect($review->canBeTribunalReferred())->toBeFalse();
});

it('implementIncrease updates linked tenancy agreement rent', function (): void {
    [, , , $property] = rentReviewTestContext();

    $agreement = TenancyAgreement::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Rent Tenant',
        'tenancy_type' => 'ast',
        'lease_start_date' => '2025-01-01',
        'rent_pcm' => 900,
        'rent_schedule' => 'monthly',
        'status' => 'active',
        'is_periodic' => true,
    ]);

    $review = app(RentReviewService::class)->createReview([
        'property_id' => $property->id,
        'tenancy_agreement_id' => $agreement->id,
        'review_type' => 'section_13',
        'current_rent_pcm' => 900,
        'proposed_rent_pcm' => 975,
    ]);

    app(RentReviewService::class)->implementIncrease($review, 975.0, Carbon::parse('2026-08-01'));

    $review->refresh();
    $agreement->refresh();

    expect($review->status)->toBe('implemented')
        ->and((float) $review->final_agreed_rent_pcm)->toBe(975.0)
        ->and((float) $agreement->rent_pcm)->toBe(975.0);

    tenancy()->end();
});
