<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyMaintenanceRequest;
use App\Models\Tenant\User;
use App\Models\Tenant\WorksOrder;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\MaintenanceHandler;
use App\Services\Tenancy\TenantCreationService;

/**
 * @return array{0: Tenant, 1: User}
 */
function maintenanceTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Maintenance '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@maintenance.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function maintenanceConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Maintenance test',
    ]);
}

function maintenanceProperty(User $user, string $address = 'Flat 4, 106 Chichester Road'): Property
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

it('create_maintenance_request stores request with property reference', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    maintenanceProperty($user);
    $conversation = maintenanceConversation($tenant, $user);

    $result = app(MaintenanceHandler::class)->handle(
        'create_maintenance_request',
        [
            'property_reference' => 'Chichester',
            'title' => 'Bathroom leak',
            'description' => 'Water leaking from ceiling in bathroom.',
            'priority' => 'urgent',
            'category' => 'plumbing',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['request_id'])->toBeInt()
        ->and($result->data['priority'])->toBe('urgent')
        ->and($result->data['category'])->toBe('plumbing');

    $request = PropertyMaintenanceRequest::query()->find($result->data['request_id']);
    expect($request?->status)->toBe('open')
        ->and($request?->title)->toBe('Bathroom leak');

    tenancy()->end();
});

it('list_maintenance returns open requests for a property', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    $property = maintenanceProperty($user);
    PropertyMaintenanceRequest::query()->create([
        'property_id' => $property->id,
        'title' => 'Boiler fault',
        'description' => 'No heating',
        'status' => 'open',
        'priority' => 'urgent',
        'category' => 'appliance',
        'reported_at' => now()->toDateString(),
    ]);

    $conversation = maintenanceConversation($tenant, $user);

    $result = app(MaintenanceHandler::class)->handle(
        'list_maintenance',
        ['property_reference' => 'Flat 4'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['total'])->toBe(1)
        ->and($result->data['open'])->toBe(1)
        ->and($result->data['requests'][0]['title'])->toBe('Boiler fault');

    tenancy()->end();
});

it('assign_contractor suggests plumbers when contractor not specified', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    $property = maintenanceProperty($user);
    $request = PropertyMaintenanceRequest::query()->create([
        'property_id' => $property->id,
        'title' => 'Leaking tap',
        'description' => 'Kitchen tap dripping',
        'status' => 'open',
        'priority' => 'normal',
        'category' => 'plumbing',
        'reported_at' => now()->toDateString(),
    ]);

    Contact::query()->create([
        'name' => 'James Plumber',
        'first_name' => 'James',
        'last_name' => 'Plumber',
        'type' => 'contractor',
        'role' => 'Plumber',
        'phone' => '07700900123',
        'custom_fields' => ['trade' => 'plumber'],
        'created_by' => $user->id,
    ]);

    $conversation = maintenanceConversation($tenant, $user);

    $result = app(MaintenanceHandler::class)->handle(
        'assign_contractor',
        ['request_id' => $request->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['suggestion'])->toBeTrue()
        ->and($result->data['contractors'])->toHaveCount(1)
        ->and($result->data['contractors'][0]['name'])->toBe('James Plumber');

    tenancy()->end();
});

it('assign_contractor creates works order and schedules job', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    $property = maintenanceProperty($user);
    $request = PropertyMaintenanceRequest::query()->create([
        'property_id' => $property->id,
        'title' => 'Bathroom leak',
        'description' => 'Leak in ensuite',
        'status' => 'open',
        'priority' => 'urgent',
        'category' => 'plumbing',
        'reported_at' => now()->toDateString(),
    ]);

    $contractor = Contact::query()->create([
        'name' => 'James Plumber',
        'first_name' => 'James',
        'last_name' => 'Plumber',
        'type' => 'contractor',
        'role' => 'Plumber',
        'phone' => '07700900123',
        'custom_fields' => ['trade' => 'plumber'],
        'created_by' => $user->id,
    ]);

    $conversation = maintenanceConversation($tenant, $user);

    $result = app(MaintenanceHandler::class)->handle(
        'assign_contractor',
        [
            'request_id' => $request->id,
            'contractor_id' => $contractor->id,
            'scheduled_date' => '2026-07-15',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['works_order_id'])->toBeInt();

    $request->refresh();
    expect($request->status)->toBe('scheduled');

    $worksOrder = WorksOrder::query()->find($result->data['works_order_id']);
    expect($worksOrder?->contractor_contact_id)->toBe($contractor->id)
        ->and($worksOrder?->status)->toBe('scheduled');

    tenancy()->end();
});

it('update_maintenance_status completes request and records invoice', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    $property = maintenanceProperty($user);
    $request = PropertyMaintenanceRequest::query()->create([
        'property_id' => $property->id,
        'title' => 'Bathroom leak',
        'description' => 'Fixed washer',
        'status' => 'scheduled',
        'priority' => 'normal',
        'category' => 'plumbing',
        'reported_at' => now()->toDateString(),
    ]);

    $contractor = Contact::query()->create([
        'name' => 'James Plumber',
        'first_name' => 'James',
        'last_name' => 'Plumber',
        'type' => 'contractor',
        'role' => 'Plumber',
        'custom_fields' => ['trade' => 'plumber'],
        'created_by' => $user->id,
    ]);

    WorksOrder::query()->create([
        'property_id' => $property->id,
        'maintenance_request_id' => $request->id,
        'contractor_contact_id' => $contractor->id,
        'title' => $request->title,
        'status' => 'scheduled',
        'trade' => 'plumber',
        'created_by' => $user->id,
    ]);

    $conversation = maintenanceConversation($tenant, $user);

    $result = app(MaintenanceHandler::class)->handle(
        'update_maintenance_status',
        [
            'request_id' => $request->id,
            'status' => 'completed',
            'invoice_amount' => 180.00,
            'outcome_notes' => 'Replaced washer and tested.',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['invoice_amount'])->toBe(180.0);

    $request->refresh();
    expect($request->status)->toBe('completed')
        ->and($request->resolved_at)->not->toBeNull();

    $job = WorksOrder::query()->where('maintenance_request_id', $request->id)->first();
    expect((float) $job?->actual_amount)->toBe(180.0)
        ->and($job?->status)->toBe('completed');

    tenancy()->end();
});

it('manage_contractor adds contractor contact', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    $conversation = maintenanceConversation($tenant, $user);

    $result = app(MaintenanceHandler::class)->handle(
        'manage_contractor',
        [
            'action' => 'add',
            'name' => 'Sarah Electric',
            'trade' => 'electrician',
            'phone' => '07700900456',
            'email' => 'sarah@spark.test',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['contractor_id'])->toBeInt();

    $contractor = Contact::query()->find($result->data['contractor_id']);
    expect($contractor?->type)->toBe('contractor')
        ->and($contractor?->custom_fields['trade'])->toBe('electrician');

    tenancy()->end();
});

it('list_contractors filters by trade', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    Contact::query()->create([
        'name' => 'James Plumber',
        'first_name' => 'James',
        'last_name' => 'Plumber',
        'type' => 'contractor',
        'role' => 'Plumber',
        'custom_fields' => ['trade' => 'plumber'],
        'created_by' => $user->id,
    ]);
    Contact::query()->create([
        'name' => 'Sarah Electric',
        'first_name' => 'Sarah',
        'last_name' => 'Electric',
        'type' => 'contractor',
        'role' => 'Electrician',
        'custom_fields' => ['trade' => 'electrician'],
        'created_by' => $user->id,
    ]);

    $conversation = maintenanceConversation($tenant, $user);

    $result = app(MaintenanceHandler::class)->handle(
        'list_contractors',
        ['trade' => 'plumber'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['contractors'])->toHaveCount(1)
        ->and($result->data['contractors'][0]['name'])->toBe('James Plumber');

    tenancy()->end();
});

it('dispatches create_maintenance_request via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = maintenanceTenant();
    tenancy()->initialize($tenant);

    maintenanceProperty($user);
    app()->forgetInstance(CarinaModuleToolDispatcher::class);
    $conversation = maintenanceConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'create_maintenance_request',
        [
            'property_reference' => '106 Chichester',
            'description' => 'Boiler not heating water.',
            'priority' => 'emergency',
            'category' => 'heating',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['priority'])->toBe('urgent')
        ->and($result->data['category'])->toBe('appliance');

    tenancy()->end();
});
