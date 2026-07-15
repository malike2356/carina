<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\HmoCheck;
use App\Models\Tenant\HmoLicence;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\InsuranceHmoComplianceHandler;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Carbon;

/**
 * @return array{0: Tenant, 1: User}
 */
function insuranceHmoTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Insurance HMO '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@insurancehmo.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function insuranceHmoConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Insurance HMO test',
    ]);
}

function insuranceHmoProperty(User $user, string $address = '15 St Andrews Road'): Property
{
    return Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => $address,
        'city' => 'Portsmouth',
        'postcode' => 'PO4 1AA',
        'property_type' => 'house',
        'bedrooms' => 6,
    ]);
}

it('manage_insurance stores policy as compliance item', function (): void {
    [$tenant, $user] = insuranceHmoTenant();
    tenancy()->initialize($tenant);

    $property = insuranceHmoProperty($user);
    $conversation = insuranceHmoConversation($tenant, $user);

    $result = app(InsuranceHmoComplianceHandler::class)->handle(
        'manage_insurance',
        [
            'property_reference' => 'St Andrews',
            'policy_type' => 'landlord',
            'provider' => 'AXA',
            'policy_number' => 'LBI-12345',
            'annual_premium' => 420.00,
            'start_date' => '2025-11-01',
            'expiry_date' => '2026-10-31',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['policy_type'])->toBe('landlord');

    $item = ComplianceItem::query()
        ->where('property_id', $property->id)
        ->where('category', 'insurance')
        ->first();

    expect($item)->not->toBeNull()
        ->and($item->type)->toBe('landlord_insurance')
        ->and($item->expires_at?->toDateString())->toBe('2026-10-31');

    tenancy()->end();
});

it('list_insurance returns policies for property', function (): void {
    [$tenant, $user] = insuranceHmoTenant();
    tenancy()->initialize($tenant);

    $property = insuranceHmoProperty($user);
    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'insurance',
        'type' => 'buildings',
        'title' => 'Buildings insurance - Aviva',
        'expires_at' => now()->addMonths(8)->toDateString(),
        'status' => 'valid',
        'notes' => json_encode(['provider' => 'Aviva', 'policy_type' => 'buildings', 'annual_premium' => 500]),
    ]);

    $conversation = insuranceHmoConversation($tenant, $user);

    $result = app(InsuranceHmoComplianceHandler::class)->handle(
        'list_insurance',
        ['property_reference' => 'St Andrews'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['policies'])->toHaveCount(1)
        ->and($result->data['policies'][0]['provider'])->toBe('Aviva');

    tenancy()->end();
});

it('insurance_expiring detects expired and upcoming policies', function (): void {
    [$tenant, $user] = insuranceHmoTenant();
    tenancy()->initialize($tenant);

    $property = insuranceHmoProperty($user);

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'insurance',
        'type' => 'landlord_insurance',
        'title' => 'Expired policy',
        'expires_at' => now()->subDays(5)->toDateString(),
        'status' => 'expired',
        'notes' => json_encode(['policy_type' => 'landlord']),
    ]);

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'insurance',
        'type' => 'buildings',
        'title' => 'Expiring soon',
        'expires_at' => now()->addDays(20)->toDateString(),
        'status' => 'valid',
        'notes' => json_encode(['policy_type' => 'buildings']),
    ]);

    $conversation = insuranceHmoConversation($tenant, $user);

    $result = app(InsuranceHmoComplianceHandler::class)->handle(
        'insurance_expiring',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['expired'])->toBe(1)
        ->and($result->data['expiring_soon'])->toBe(1)
        ->and($result->data['urgent'])->toHaveCount(1);

    tenancy()->end();
});

it('hmo_check flags mandatory licensing for five tenants three households', function (): void {
    [$tenant, $user] = insuranceHmoTenant();
    tenancy()->initialize($tenant);

    $property = insuranceHmoProperty($user);
    $conversation = insuranceHmoConversation($tenant, $user);

    $result = app(InsuranceHmoComplianceHandler::class)->handle(
        'hmo_check',
        [
            'property_reference' => 'St Andrews',
            'tenant_count' => 5,
            'household_count' => 3,
            'storeys' => 3,
            'local_authority' => 'Portsmouth City Council',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['mandatory_hmo'])->toBeTrue()
        ->and($result->data['license_status'])->toBe('required_not_applied')
        ->and($result->data['requirements'])->not->toBeEmpty();

    $check = HmoCheck::query()->where('property_id', $property->id)->first();
    expect($check?->license_status)->toBe('required_not_applied');

    $property->refresh();
    expect($property->hmo_license_required)->toBeTrue();

    expect(HmoLicence::query()->where('property_id', $property->id)->exists())->toBeTrue();

    tenancy()->end();
});

it('hmo_check reports no mandatory license for low occupancy', function (): void {
    [$tenant, $user] = insuranceHmoTenant();
    tenancy()->initialize($tenant);

    insuranceHmoProperty($user);
    $conversation = insuranceHmoConversation($tenant, $user);

    $result = app(InsuranceHmoComplianceHandler::class)->handle(
        'hmo_check',
        [
            'property_reference' => 'St Andrews',
            'tenant_count' => 2,
            'household_count' => 2,
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['mandatory_hmo'])->toBeFalse()
        ->and($result->data['additional_licensing'])->toBeFalse()
        ->and($result->data['license_status'])->toBe('not_required');

    tenancy()->end();
});

it('hmo_compliance_status lists flagged properties', function (): void {
    [$tenant, $user] = insuranceHmoTenant();
    tenancy()->initialize($tenant);

    $property = insuranceHmoProperty($user);
    HmoCheck::query()->create([
        'property_id' => $property->id,
        'license_status' => 'required_not_applied',
        'tenant_count' => 6,
        'household_count' => 4,
        'fire_doors_fitted' => false,
    ]);

    $conversation = insuranceHmoConversation($tenant, $user);

    $result = app(InsuranceHmoComplianceHandler::class)->handle(
        'hmo_compliance_status',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['properties_affected'])->toBe(1)
        ->and($result->data['not_yet_applied'])->toBe(1)
        ->and($result->data['statuses'][0]['compliance']['fire_doors'])->toBeFalse();

    tenancy()->end();
});

it('dispatches manage_insurance via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = insuranceHmoTenant();
    tenancy()->initialize($tenant);

    insuranceHmoProperty($user);
    app()->forgetInstance(CarinaModuleToolDispatcher::class);
    $conversation = insuranceHmoConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'manage_insurance',
        [
            'property_reference' => 'St Andrews',
            'policy_type' => 'contents',
            'provider' => 'Direct Line',
            'expiry_date' => Carbon::now()->addYear()->toDateString(),
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and(ComplianceItem::query()->where('category', 'insurance')->count())->toBe(1);

    tenancy()->end();
});
