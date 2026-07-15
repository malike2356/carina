<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Expense;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\SourcingLead;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\AdvancedOpsHandler;
use App\Services\Tenancy\TenantCreationService;

/**
 * @return array{0: Tenant, 1: User}
 */
function advancedOpsTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Advanced Ops '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@advancedops.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    if (! GlAccount::query()->where('code', '1000')->where('is_active', true)->exists()) {
        GlAccount::query()->delete();
        app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    }
    tenancy()->end();

    return [$tenant, $user];
}

function advancedOpsConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Advanced ops test',
    ]);
}

function advancedOpsProperty(User $user, string $address): Property
{
    return Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => $address,
        'city' => 'Portsmouth',
        'postcode' => 'PO5 1AA',
        'property_type' => 'flat',
        'bedrooms' => 2,
        'purchase_price' => 200000,
        'current_value' => 215000,
        'monthly_mortgage' => 650,
    ]);
}

it('manage_sourcing_lead adds a new lead', function (): void {
    [$tenant, $user] = advancedOpsTenant();
    tenancy()->initialize($tenant);

    $conversation = advancedOpsConversation($tenant, $user);

    $result = app(AdvancedOpsHandler::class)->handle(
        'manage_sourcing_lead',
        [
            'action' => 'add',
            'property_address' => '12 Auction Road',
            'source' => 'auction',
            'asking_price' => 175000,
            'estimated_monthly_rent' => 1100,
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['stage'])->toBe('identified');

    $lead = SourcingLead::query()->find($result->data['lead_id']);
    expect($lead)->not->toBeNull()
        ->and($lead->source)->toBe('auction');

    tenancy()->end();
});

it('manage_sourcing_lead updates stage and estimated roi', function (): void {
    [$tenant, $user] = advancedOpsTenant();
    tenancy()->initialize($tenant);

    $lead = SourcingLead::query()->create([
        'property_address' => '8 Offer Street',
        'source' => 'agent',
        'asking_price' => 160000,
        'offer_amount' => 150000,
        'estimated_monthly_rent' => 950,
        'stage' => 'offer_made',
        'assigned_to_user_id' => $user->id,
    ]);

    $conversation = advancedOpsConversation($tenant, $user);

    $result = app(AdvancedOpsHandler::class)->handle(
        'manage_sourcing_lead',
        [
            'action' => 'update',
            'lead_id' => $lead->id,
            'stage' => 'offer_accepted',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['stage'])->toBe('offer_accepted')
        ->and($result->data['estimated_roi'])->toEqual(7.6);

    tenancy()->end();
});

it('pipeline_overview groups active leads by stage', function (): void {
    [$tenant, $user] = advancedOpsTenant();
    tenancy()->initialize($tenant);

    SourcingLead::query()->create([
        'property_address' => 'Lead A',
        'source' => 'online',
        'stage' => 'identified',
    ]);
    SourcingLead::query()->create([
        'property_address' => 'Lead B',
        'source' => 'agent',
        'stage' => 'offer_made',
        'offer_amount' => 140000,
    ]);

    $conversation = advancedOpsConversation($tenant, $user);

    $result = app(AdvancedOpsHandler::class)->handle(
        'pipeline_overview',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['total_active'])->toBe(2)
        ->and($result->data['in_negotiation'])->toBe(1)
        ->and($result->data['pipeline'])->toHaveKey('identified')
        ->and($result->data['pipeline'])->toHaveKey('offer_made');

    tenancy()->end();
});

it('record_expense stores expense with landlord tax category', function (): void {
    [$tenant, $user] = advancedOpsTenant();
    tenancy()->initialize($tenant);

    advancedOpsProperty($user, '22 Expense Close');
    $conversation = advancedOpsConversation($tenant, $user);

    $result = app(AdvancedOpsHandler::class)->handle(
        'record_expense',
        [
            'property_reference' => 'Expense Close',
            'category' => 'repairs',
            'amount' => 240.50,
            'description' => 'Boiler repair',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['category'])->toBe('repairs')
        ->and($result->data['amount_gbp'])->toEqual(240.5);

    $expense = Expense::query()->find($result->data['expense_id']);
    expect($expense)->not->toBeNull()
        ->and($expense->landlord_tax_category)->toBe('repairs')
        ->and($expense->tax_deductible)->toBeTrue();

    tenancy()->end();
});

it('tax_summary calculates rental income and expenses for tax year', function (): void {
    [$tenant, $user] = advancedOpsTenant();
    tenancy()->initialize($tenant);

    $property = advancedOpsProperty($user, '30 Tax Terrace');
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tax Tenant',
        'start_date' => '2025-05-01',
        'rent_amount' => 900,
        'tenancy_type' => 'ast',
    ]);

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 90000,
        'due_date' => '2025-06-01',
        'paid_date' => '2025-06-02',
        'status' => 'paid',
        'created_by' => $user->id,
    ]);

    $expenseResult = app(AdvancedOpsHandler::class)->handle(
        'record_expense',
        [
            'property_reference' => 'Tax Terrace',
            'category' => 'insurance',
            'amount' => 300,
            'expense_date' => '2025-08-15',
        ],
        $user,
        advancedOpsConversation($tenant, $user),
    );

    expect($expenseResult->success)->toBeTrue($expenseResult->summary);

    $conversation = advancedOpsConversation($tenant, $user);

    $result = app(AdvancedOpsHandler::class)->handle(
        'tax_summary',
        ['tax_year' => '2025-2026'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['total_rental_income_gbp'])->toEqual(900.0)
        ->and($result->data['total_expenses_gbp'])->toEqual(300.0)
        ->and($result->data['net_income_gbp'])->toEqual(600.0)
        ->and($result->summary)->toContain('Consult your accountant');

    tenancy()->end();
});

it('portfolio_intelligence ranks properties and flags vacancies', function (): void {
    [$tenant, $user] = advancedOpsTenant();
    tenancy()->initialize($tenant);

    $strong = advancedOpsProperty($user, '40 Yield Lane');
    $strong->update(['purchase_price' => 100000, 'current_value' => 120000]);

    PropertyTenancy::query()->create([
        'property_id' => $strong->id,
        'tenant_name' => 'Strong Tenant',
        'start_date' => now()->subYear()->toDateString(),
        'rent_amount' => 1000,
        'tenancy_type' => 'ast',
    ]);

    advancedOpsProperty($user, '41 Vacant View');

    $conversation = advancedOpsConversation($tenant, $user);

    $result = app(AdvancedOpsHandler::class)->handle(
        'portfolio_intelligence',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['property_count'])->toBe(2)
        ->and($result->data['best_performer']['property'])->toContain('Yield Lane')
        ->and(collect($result->data['all_properties'])->contains(fn (array $row): bool => ($row['vacant'] ?? false) === true))->toBeTrue();

    tenancy()->end();
});

it('registers advanced ops tools in the dispatcher', function (): void {
    [$tenant, $user] = advancedOpsTenant();
    tenancy()->initialize($tenant);

    $conversation = advancedOpsConversation($tenant, $user);
    $dispatcher = app(CarinaModuleToolDispatcher::class);

    $result = $dispatcher->dispatch('pipeline_overview', [], $user, $conversation);

    expect($result->success)->toBeTrue();

    tenancy()->end();
});
