<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Enforcement\CouncilCommunicationLog;
use App\Models\Tenant\Enforcement\EnforcementNotice;
use App\Models\Tenant\Enforcement\HousingFinancialPenalty;
use App\Models\Tenant\Enforcement\RentRepaymentRisk;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Compliance\EnforcementService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

function enforcementTestContext(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Enforcement Defence '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@enforcement.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '22 Enforcement Road',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'hmo',
        'status' => 'managing',
        'strategy' => 'hmo',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    return [$tenant, $host, $user, $property];
}

it('creates an enforcement notice', function (): void {
    [$tenant, $host, $user, $property] = enforcementTestContext();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/enforcement/notices', [
        'property_id' => $property->id,
        'notice_type' => 'improvement_notice',
        'notice_reference' => 'IN-2026-001',
        'issuing_authority' => 'Manchester City Council',
        'served_date' => '2026-05-01',
        'response_deadline' => '2026-06-01',
        'status' => 'received',
        'contravention_description' => 'Category 1 damp hazard in bedroom 2.',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $notice = EnforcementNotice::query()->where('notice_reference', 'IN-2026-001')->first();
    expect($notice)->not->toBeNull()
        ->and($notice->property_id)->toBe($property->id)
        ->and($notice->notice_type)->toBe('improvement_notice')
        ->and($notice->created_by_user_id)->toBe($user->id);
    tenancy()->end();
});

it('returns correct total financial exposure', function (): void {
    [$tenant, , , $property] = enforcementTestContext();

    tenancy()->initialize($tenant);

    HousingFinancialPenalty::query()->create([
        'property_id' => $property->id,
        'issuing_authority' => 'Test Council',
        'penalty_type' => 'unlicensed_hmo',
        'penalty_amount' => 15000,
        'paid_amount' => 5000,
        'status' => 'final_notice',
    ]);

    HousingFinancialPenalty::query()->create([
        'property_id' => $property->id,
        'issuing_authority' => 'Test Council',
        'penalty_type' => 'overcrowding',
        'penalty_amount' => 8000,
        'status' => 'paid',
        'paid_amount' => 8000,
    ]);

    RentRepaymentRisk::query()->create([
        'property_id' => $property->id,
        'estimated_exposure_amount' => 11400,
        'risk_level' => 'high',
        'status' => 'monitoring',
    ]);

    $exposure = app(EnforcementService::class)->getTotalFinancialExposure();

    expect($exposure['penalties_outstanding'])->toBe(10000.0)
        ->and($exposure['rro_exposure'])->toBe(11400.0)
        ->and($exposure['total'])->toBe(21400.0);

    tenancy()->end();
});

it('marks response overdue when deadline passed and status is received', function (): void {
    Carbon::setTestNow('2026-06-10');

    $notice = new EnforcementNotice([
        'status' => 'received',
        'response_deadline' => '2026-06-01',
    ]);

    expect($notice->isResponseOverdue())->toBeTrue();

    $notice->status = 'complied';
    expect($notice->isResponseOverdue())->toBeFalse();

    Carbon::setTestNow();
});

it('logs council communication against a notice', function (): void {
    [$tenant, $host, $user, $property] = enforcementTestContext();

    tenancy()->initialize($tenant);
    $notice = EnforcementNotice::query()->create([
        'property_id' => $property->id,
        'notice_type' => 'improvement_notice',
        'issuing_authority' => 'Manchester City Council',
        'served_date' => '2026-05-01',
        'status' => 'received',
        'created_by_user_id' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/enforcement/communications', [
        'property_id' => $property->id,
        'enforcement_notice_id' => $notice->id,
        'contact_date' => '2026-05-15',
        'communication_type' => 'call',
        'direction' => 'inbound',
        'officer_name' => 'Officer Smith',
        'summary' => 'Council called to confirm remediation timeline.',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $log = CouncilCommunicationLog::query()->where('enforcement_notice_id', $notice->id)->first();
    expect($log)->not->toBeNull()
        ->and($log->officer_name)->toBe('Officer Smith')
        ->and($log->logged_by_user_id)->toBe($user->id);
    tenancy()->end();
});
