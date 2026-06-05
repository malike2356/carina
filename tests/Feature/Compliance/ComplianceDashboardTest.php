<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Enforcement\HousingFinancialPenalty;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Compliance\ComplianceDashboardService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

function complianceDashboardTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Dashboard '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-dashboard.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('returns a snapshot with all expected top-level keys', function (): void {
    [$tenant] = complianceDashboardTenant();

    tenancy()->initialize($tenant);
    $snapshot = app(ComplianceDashboardService::class)->getSnapshot();
    tenancy()->end();

    expect($snapshot)->toHaveKeys([
        'certificates',
        'hmo_licences',
        'selective_licences',
        'hhsrs',
        'fire_safety',
        'enforcement',
        'decent_homes',
        'tenancy',
        'inspections',
        'training',
        'asbestos_water',
        'audit',
        'modules',
    ]);

    expect($snapshot['certificates'])->toHaveKeys(['total_items', 'red_count', 'amber_count', 'green_count']);
    expect($snapshot['hmo_licences'])->toHaveKeys(['expired_count', 'renewal_due_count', 'pending_count']);
    expect($snapshot['enforcement'])->toHaveKeys([
        'active_notices_count',
        'outstanding_penalties_count',
        'total_financial_exposure',
    ]);
});

it('increments certificates red_count when a compliance item is expired', function (): void {
    [$tenant] = complianceDashboardTenant();

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '1 Expired Cert Lane',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'residential',
        'created_by' => $user->id,
    ]);

    $service = app(ComplianceDashboardService::class);
    $before = $service->getSnapshot()['certificates']['red_count'];

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Expired gas safety',
        'expires_at' => now()->subDay()->toDateString(),
        'reminder_days' => 30,
        'status' => 'expired',
    ]);

    $after = $service->getSnapshot()['certificates']['red_count'];
    tenancy()->end();

    expect($after)->toBe($before + 1);
});

it('sums enforcement total_financial_exposure from outstanding penalties', function (): void {
    [$tenant] = complianceDashboardTenant();

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '2 Penalty Street',
        'city' => 'Leeds',
        'postcode' => 'LS3 3CC',
        'property_type' => 'residential',
        'created_by' => $user->id,
    ]);

    HousingFinancialPenalty::query()->create([
        'property_id' => $property->id,
        'issuing_authority' => 'Test Council',
        'penalty_type' => 'civil_penalty',
        'offence_description' => 'Test offence',
        'penalty_amount' => 1500.00,
        'paid_amount' => 500.00,
        'status' => 'final_notice',
    ]);

    HousingFinancialPenalty::query()->create([
        'property_id' => $property->id,
        'issuing_authority' => 'Test Council',
        'penalty_type' => 'civil_penalty',
        'offence_description' => 'Second offence',
        'penalty_amount' => 800.00,
        'paid_amount' => 0,
        'status' => 'final_notice',
    ]);

    $snapshot = app(ComplianceDashboardService::class)->getSnapshot();
    tenancy()->end();

    expect($snapshot['enforcement']['outstanding_penalties_count'])->toBe(2)
        ->and($snapshot['enforcement']['total_financial_exposure'])->toBe(1800.0);
});

it('shows the unified dashboard on the compliance index page', function (): void {
    [$tenant, $host, $user] = complianceDashboardTenant();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/compliance')
        ->assertOk()
        ->assertSee('Compliance risk overview')
        ->assertSee('Unified RAG status');
});
