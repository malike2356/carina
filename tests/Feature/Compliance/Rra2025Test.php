<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DecentHomesAssessment;
use App\Models\Tenant\Property;
use App\Models\Tenant\PrsRegistration;
use App\Models\Tenant\User;
use App\Services\Compliance\RrA2025Service;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function rra2025TestContext(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'RRA 2025 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rra2025.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '22 RRA Street',
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

it('creates and updates PRS registration', function (): void {
    [$tenant, $host, $user] = rra2025TestContext();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/compliance/rra-2025/prs-registration', [
        'registration_type' => 'landlord',
        'registration_number' => 'PRS-001',
        'status' => 'registered',
        'registered_entity_name' => 'Test Lettings Ltd',
        'registration_date' => '2026-01-01',
        'expiry_date' => '2027-01-01',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $registration = PrsRegistration::query()->first();
    expect($registration)->not->toBeNull()
        ->and($registration->registration_number)->toBe('PRS-001')
        ->and($registration->status)->toBe('registered')
        ->and($registration->isActive())->toBeTrue();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post($base.'/compliance/rra-2025/prs-registration', [
        'registration_type' => 'landlord',
        'registration_number' => 'PRS-002',
        'status' => 'registered',
        'registered_entity_name' => 'Test Lettings Ltd',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(PrsRegistration::query()->count())->toBe(1)
        ->and(PrsRegistration::query()->first()->registration_number)->toBe('PRS-002');
    tenancy()->end();
});

it('flags holding deposit is_within_cap when amount equals weekly rent', function (): void {
    [$tenant, , , $property] = rra2025TestContext();

    tenancy()->initialize($tenant);
    $log = app(RrA2025Service::class)->logPreTenancyPayment([
        'property_id' => $property->id,
        'payment_type' => 'holding_deposit',
        'amount' => 250,
        'weekly_rent' => 250,
        'payment_date' => now()->toDateString(),
    ]);

    expect($log->is_within_cap)->toBeTrue()
        ->and((float) $log->holding_deposit_cap)->toBe(250.0);
    tenancy()->end();
});

it('returns false from allCriteriaMet when any criterion is false', function (): void {
    [$tenant, , , $property] = rra2025TestContext();

    tenancy()->initialize($tenant);
    $assessment = DecentHomesAssessment::create([
        'property_id' => $property->id,
        'assessment_date' => now()->toDateString(),
        'criterion_non_decent_hazard' => true,
        'criterion_reasonable_state_of_repair' => true,
        'criterion_reasonably_modern_facilities' => false,
        'criterion_thermal_comfort' => true,
        'status' => 'draft',
    ]);

    expect($assessment->allCriteriaMet())->toBeFalse()
        ->and($assessment->getFailedCriteria())->toContain('Reasonably modern facilities');
    tenancy()->end();
});

it('returns expected keys from getWorkspaceComplianceStatus', function (): void {
    [$tenant] = rra2025TestContext();

    tenancy()->initialize($tenant);
    $status = app(RrA2025Service::class)->getWorkspaceComplianceStatus();

    expect($status)->toHaveKeys([
        'prs_registration',
        'ombudsman',
        'decent_homes',
        'quarterly_reports',
        'prohibited_payments',
    ])
        ->and($status['prs_registration'])->toHaveKeys(['status', 'record', 'rag'])
        ->and($status['ombudsman'])->toHaveKeys(['status', 'record', 'rag'])
        ->and($status['decent_homes'])->toHaveKeys(['not_assessed_count', 'failing_count', 'properties'])
        ->and($status['quarterly_reports'])->toHaveKeys(['overdue_count', 'reports'])
        ->and($status['prohibited_payments'])->toHaveKeys(['count', 'payments']);
    tenancy()->end();
});

it('flags prohibited payments in logPreTenancyPayment', function (): void {
    [$tenant] = rra2025TestContext();

    tenancy()->initialize($tenant);
    $log = app(RrA2025Service::class)->logPreTenancyPayment([
        'payment_type' => 'prohibited_payment',
        'amount' => 100,
    ]);

    expect($log->is_prohibited)->toBeTrue();
    tenancy()->end();
});
