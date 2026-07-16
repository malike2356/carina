<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyNote;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\ToolHandlers\PropertyOpsHandler;
use App\Services\Tenancy\TenantCreationService;

/**
 * @return array{0: Tenant, 1: User}
 */
function propertyOpsTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Property Ops '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@propertyops.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function propertyOpsConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Property ops test',
    ]);
}

function propertyOpsProperty(User $user, string $address = 'Flat 4, 106 Chichester Road'): Property
{
    return Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => $address,
        'city' => 'Portsmouth',
        'postcode' => 'PO4 0AA',
        'property_type' => 'flat',
        'bedrooms' => 2,
        'purchase_price' => 180000,
    ]);
}

it('manage_property add_tenant creates an active tenancy', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    propertyOpsProperty($user);
    $conversation = propertyOpsConversation($tenant, $user);

    $result = app(PropertyOpsHandler::class)->handle(
        'manage_property',
        [
            'action' => 'add_tenant',
            'property_reference' => 'Chichester',
            'name' => 'James Wright',
            'monthly_rent' => 950,
            'email' => 'james@example.test',
            'tenancy_start' => '2026-08-01',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['name'])->toBe('James Wright')
        ->and($result->data['monthly_rent'])->toEqual(950.0);

    $tenancy = PropertyTenancy::query()->find($result->data['tenancy_id']);
    expect($tenancy)->not->toBeNull()
        ->and($tenancy->isActive())->toBeTrue();

    tenancy()->end();
});

it('manage_property add_note stores a property note', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    $property = propertyOpsProperty($user);
    $conversation = propertyOpsConversation($tenant, $user);

    $result = app(PropertyOpsHandler::class)->handle(
        'manage_property',
        [
            'action' => 'add_note',
            'property_reference' => 'Flat 4',
            'content' => 'Boiler serviced today',
            'category' => 'maintenance',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue();

    $note = PropertyNote::query()->where('property_id', $property->id)->first();
    expect($note)->not->toBeNull()
        ->and($note->content)->toBe('Boiler serviced today')
        ->and($note->category)->toBe('maintenance');

    tenancy()->end();
});

it('manage_property update_property updates mapped fields', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    propertyOpsProperty($user);
    $conversation = propertyOpsConversation($tenant, $user);

    $result = app(PropertyOpsHandler::class)->handle(
        'manage_property',
        [
            'action' => 'update_property',
            'property_reference' => '106 Chichester',
            'bedrooms' => 3,
            'current_value' => 195000,
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['updated_fields'])->toContain('bedrooms', 'current_value');

    tenancy()->end();
});

it('query_payments returns payments for a property month', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    $property = propertyOpsProperty($user);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Alex Tenant',
        'start_date' => now()->subMonths(2)->toDateString(),
        'rent_amount' => 950,
        'tenancy_type' => 'ast',
    ]);

    $month = now()->format('Y-m');
    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 95000,
        'due_date' => now()->startOfMonth()->toDateString(),
        'paid_date' => now()->toDateString(),
        'status' => 'paid',
        'created_by' => $user->id,
    ]);

    $conversation = propertyOpsConversation($tenant, $user);

    $result = app(PropertyOpsHandler::class)->handle(
        'query_payments',
        ['property_reference' => 'Flat 4', 'month' => $month],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['payment_count'])->toBe(1)
        ->and($result->data['total_paid_gbp'])->toEqual(950.0);

    tenancy()->end();
});

it('record_payment creates payment and blocks duplicate month', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    $property = propertyOpsProperty($user);
    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Alex Tenant',
        'start_date' => now()->subMonths(2)->toDateString(),
        'rent_amount' => 950,
        'tenancy_type' => 'ast',
        'rent_due_day' => 1,
    ]);

    $conversation = propertyOpsConversation($tenant, $user);
    $month = now()->format('Y-m');

    $first = app(PropertyOpsHandler::class)->handle(
        'record_payment',
        [
            'property_reference' => 'Chichester',
            'amount' => 950,
            'month' => $month,
        ],
        $user,
        $conversation,
    );

    expect($first->success)->toBeTrue()
        ->and(TenancyRentPayment::query()->where('status', 'paid')->count())->toBe(1);

    $second = app(PropertyOpsHandler::class)->handle(
        'record_payment',
        [
            'property_reference' => 'Chichester',
            'amount' => 950,
            'month' => $month,
        ],
        $user,
        $conversation,
    );

    expect($second->success)->toBeTrue()
        ->and($second->data)->toHaveKey('warning')
        ->and(TenancyRentPayment::query()->where('status', 'paid')->count())->toBe(1);

    tenancy()->end();
});

it('portfolio_summary returns rent roll metrics', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    $property = propertyOpsProperty($user);
    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Alex Tenant',
        'start_date' => now()->subMonths(1)->toDateString(),
        'rent_amount' => 1000,
        'tenancy_type' => 'ast',
    ]);

    $conversation = propertyOpsConversation($tenant, $user);

    $result = app(PropertyOpsHandler::class)->handle(
        'portfolio_summary',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['total_properties'])->toBe(1)
        ->and($result->data['active_tenancies'])->toBe(1)
        ->and($result->data['monthly_rent_roll_gbp'])->toEqual(1000.0);

    tenancy()->end();
});

it('property_detail returns tenancy payment and note context', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    $property = propertyOpsProperty($user);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Alex Tenant',
        'email' => 'alex@example.test',
        'start_date' => now()->subMonths(1)->toDateString(),
        'rent_amount' => 900,
        'tenancy_type' => 'ast',
    ]);

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 90000,
        'due_date' => now()->startOfMonth()->toDateString(),
        'paid_date' => now()->toDateString(),
        'status' => 'paid',
        'created_by' => $user->id,
    ]);

    PropertyNote::query()->create([
        'property_id' => $property->id,
        'content' => 'New keys cut',
        'category' => 'general',
        'created_by_user_id' => $user->id,
    ]);

    $conversation = propertyOpsConversation($tenant, $user);

    $result = app(PropertyOpsHandler::class)->handle(
        'property_detail',
        ['property_reference' => 'Flat 4'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['tenancy']['name'])->toBe('Alex Tenant')
        ->and($result->data['last_payment']['amount_gbp'])->toEqual(900.0)
        ->and($result->data['recent_notes'][0]['content'])->toBe('New keys cut');

    tenancy()->end();
});

it('dispatches manage_property via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = propertyOpsTenant();
    tenancy()->initialize($tenant);

    propertyOpsProperty($user);
    app()->forgetInstance(CarinaModuleToolDispatcher::class);

    $conversation = propertyOpsConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'manage_property',
        [
            'action' => 'add_tenant',
            'property_reference' => 'Chichester',
            'name' => 'Sam Lee',
            'monthly_rent' => 800,
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['tenancy_id'])->toBeInt();

    tenancy()->end();
});

it('record_payment requires confirmation in tool registry', function (): void {
    $tool = app(CarinaToolRegistry::class)->find('record_payment');

    expect($tool)->not->toBeNull()
        ->and($tool->requiresConfirmation())->toBeTrue();
});
