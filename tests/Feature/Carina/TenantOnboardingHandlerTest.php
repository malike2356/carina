<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenantApplication;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\TenantOnboardingHandler;
use App\Services\Tenancy\TenantCreationService;

/**
 * @return array{0: Tenant, 1: User}
 */
function onboardingTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Onboarding '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@onboarding.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function onboardingConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Onboarding test',
    ]);
}

function onboardingProperty(User $user, string $address = 'Flat 4, 106 Chichester Road'): Property
{
    return Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => $address,
        'city' => 'Portsmouth',
        'postcode' => 'PO4 0AA',
        'property_type' => 'flat',
        'bedrooms' => 2,
    ]);
}

it('start_tenant_application creates enquiry with suggested deposit', function (): void {
    [$tenant, $user] = onboardingTenant();
    tenancy()->initialize($tenant);

    onboardingProperty($user);
    $conversation = onboardingConversation($tenant, $user);

    $result = app(TenantOnboardingHandler::class)->handle(
        'start_tenant_application',
        [
            'property_reference' => 'Chichester',
            'applicant_name' => 'Alex Morgan',
            'applicant_email' => 'alex@example.test',
            'proposed_rent' => 1200,
            'proposed_start_date' => '2026-08-01',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['application_id'])->toBeInt()
        ->and($result->data['suggested_deposit'])->toBe(1385.0);

    $application = TenantApplication::query()->find($result->data['application_id']);
    expect($application?->status)->toBe('enquiry')
        ->and((float) $application?->deposit_amount)->toBe(1385.0);

    tenancy()->end();
});

it('update_application_status tracks progress checklist', function (): void {
    [$tenant, $user] = onboardingTenant();
    tenancy()->initialize($tenant);

    $property = onboardingProperty($user);
    $application = TenantApplication::query()->create([
        'property_id' => $property->id,
        'applicant_name' => 'Alex Morgan',
        'proposed_rent' => 1000,
        'status' => 'enquiry',
        'deposit_amount' => 1154,
    ]);

    $conversation = onboardingConversation($tenant, $user);

    $result = app(TenantOnboardingHandler::class)->handle(
        'update_application_status',
        [
            'application_id' => $application->id,
            'status' => 'referencing',
            'referencing_passed' => true,
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['ready_to_move_in'])->toBeFalse()
        ->and($result->data['progress'][0])->toContain('Referencing: passed');

    tenancy()->end();
});

it('complete_onboarding blocks when checks incomplete', function (): void {
    [$tenant, $user] = onboardingTenant();
    tenancy()->initialize($tenant);

    $property = onboardingProperty($user);
    $application = TenantApplication::query()->create([
        'property_id' => $property->id,
        'applicant_name' => 'Alex Morgan',
        'proposed_rent' => 1000,
        'status' => 'deposit_pending',
        'referencing_passed' => true,
        'right_to_rent_verified' => true,
        'deposit_received' => false,
    ]);

    $conversation = onboardingConversation($tenant, $user);

    $result = app(TenantOnboardingHandler::class)->handle(
        'complete_onboarding',
        ['application_id' => $application->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and($result->summary)->toContain('deposit');

    tenancy()->end();
});

it('complete_onboarding creates property tenancy when all checks pass', function (): void {
    [$tenant, $user] = onboardingTenant();
    tenancy()->initialize($tenant);

    $property = onboardingProperty($user);
    $application = TenantApplication::query()->create([
        'property_id' => $property->id,
        'applicant_name' => 'Alex Morgan',
        'applicant_email' => 'alex@example.test',
        'applicant_phone' => '07700900111',
        'proposed_rent' => 1200,
        'proposed_start_date' => '2026-08-01',
        'status' => 'ready',
        'referencing_passed' => true,
        'right_to_rent_verified' => true,
        'deposit_received' => true,
        'deposit_amount' => 1385,
        'move_in_date' => '2026-08-01',
    ]);

    $conversation = onboardingConversation($tenant, $user);

    $result = app(TenantOnboardingHandler::class)->handle(
        'complete_onboarding',
        ['application_id' => $application->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['tenancy_id'])->toBeInt();

    $tenancy = PropertyTenancy::query()->find($result->data['tenancy_id']);
    expect($tenancy?->tenant_name)->toBe('Alex Morgan')
        ->and($tenancy?->referencing_status)->toBe('passed')
        ->and($tenancy?->right_to_rent_status)->toBe('pass')
        ->and((float) $tenancy?->deposit)->toBe(1385.0)
        ->and($tenancy?->agreement_status)->toBe('unsigned');

    $application->refresh();
    expect($application->status)->toBe('approved')
        ->and($application->property_tenancy_id)->toBe($tenancy?->id);

    tenancy()->end();
});

it('list_applications counts ready applications', function (): void {
    [$tenant, $user] = onboardingTenant();
    tenancy()->initialize($tenant);

    $property = onboardingProperty($user);
    TenantApplication::query()->create([
        'property_id' => $property->id,
        'applicant_name' => 'Ready Applicant',
        'proposed_rent' => 900,
        'status' => 'ready',
        'referencing_passed' => true,
        'right_to_rent_verified' => true,
        'deposit_received' => true,
    ]);
    TenantApplication::query()->create([
        'property_id' => $property->id,
        'applicant_name' => 'Pending Applicant',
        'proposed_rent' => 900,
        'status' => 'referencing',
    ]);

    $conversation = onboardingConversation($tenant, $user);

    $result = app(TenantOnboardingHandler::class)->handle(
        'list_applications',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['ready'])->toBe(1)
        ->and($result->data['applications'])->toHaveCount(2);

    tenancy()->end();
});

it('dispatches start_tenant_application via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = onboardingTenant();
    tenancy()->initialize($tenant);

    onboardingProperty($user);
    app()->forgetInstance(CarinaModuleToolDispatcher::class);
    $conversation = onboardingConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'start_tenant_application',
        [
            'property_reference' => '106 Chichester',
            'applicant_name' => 'Jamie Lee',
            'proposed_rent' => 950,
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['applicant'])->toBe('Jamie Lee');

    tenancy()->end();
});

it('calculates five week deposit to nearest pound', function (): void {
    [$tenant, $user] = onboardingTenant();
    tenancy()->initialize($tenant);

    onboardingProperty($user);
    $conversation = onboardingConversation($tenant, $user);

    $result = app(TenantOnboardingHandler::class)->handle(
        'start_tenant_application',
        [
            'property_reference' => 'Chichester',
            'applicant_name' => 'Deposit Test',
            'proposed_rent' => 1000,
        ],
        $user,
        $conversation,
    );

    expect($result->data['suggested_deposit'])->toBe(round(1000 * 12 / 52 * 5, 0));

    tenancy()->end();
});
