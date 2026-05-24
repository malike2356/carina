<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\Room;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\Tools\Hmo\DraftSection8Tool;
use App\Services\Carina\Tools\Hmo\GetRoomOccupancyTool;
use App\Services\Carina\Tools\Hmo\GetVoidRoomsTool;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    config(['nexio.rra_2025_implementation_date' => '2025-10-01']);
});

it('registers all eight HMO Carina tools', function (): void {
    $names = array_map(fn ($t) => $t->name(), app(CarinaToolRegistry::class)->all());

    expect($names)->toContain('get_room_occupancy')
        ->toContain('get_compliance_score')
        ->toContain('get_void_rooms')
        ->toContain('check_licence_expiry')
        ->toContain('calculate_room_yield')
        ->toContain('draft_section_8')
        ->toContain('get_fire_log_status')
        ->toContain('get_awaabs_at_risk');
});

it('get_room_occupancy returns rooms for the authenticated tenant property', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Tools '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'hmo-tools-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $tenant->persona = 'hmo';
    $tenant->save();

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '10 Room Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Room 1',
        'status' => 'occupied',
        'rent_pcm' => 550,
    ]);

    $conversation = CarinaConversation::query()->create([
        'user_id' => $user->id,
        'tenant_id' => $tenant->getTenantKey(),
        'title' => 'Test',
    ]);

    $tool = app(GetRoomOccupancyTool::class);
    $result = $tool->execute(['property_id' => $property->id], $user, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['rooms'])->toHaveCount(1)
        ->and($result->data['rooms'][0]['name'])->toBe('Room 1');

    tenancy()->end();
});

it('get_room_occupancy returns empty when no rooms exist', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Empty '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'hmo-empty-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $tenant->persona = 'hmo';
    $tenant->save();

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => 'Empty HMO',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $conversation = CarinaConversation::query()->create([
        'user_id' => $user->id,
        'tenant_id' => $tenant->getTenantKey(),
        'title' => 'Test',
    ]);

    $result = app(GetRoomOccupancyTool::class)->execute(['property_id' => $property->id], $user, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['rooms'])->toBe([])
        ->and($result->summary)->toContain('No rooms');

    tenancy()->end();
});

it('draft_section_8 calls LegalNoticeService and returns a draft notice', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO S8 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'hmo-s8-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $tenant->persona = 'hmo';
    $tenant->save();

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '3 Notice Road',
        'city' => 'Leeds',
        'postcode' => 'LS3 3CC',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Alex Tenant',
        'legal_name' => 'Alex Tenant',
        'rent_amount' => 600,
        'start_date' => '2024-06-01',
    ]);

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 60000,
        'due_date' => now()->subMonth()->toDateString(),
        'status' => 'late',
        'created_by' => $user->id,
    ]);

    $conversation = CarinaConversation::query()->create([
        'user_id' => $user->id,
        'tenant_id' => $tenant->getTenantKey(),
        'title' => 'Test',
    ]);

    $tool = app(DraftSection8Tool::class);
    expect($tool->requiresConfirmation())->toBeTrue();

    $result = $tool->execute([
        'tenancy_id' => $tenancy->id,
        'grounds' => ['ground_8'],
    ], $user, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['notice_type'])->toBe('section_8')
        ->and($result->data['tenant_name'])->toBe('Alex Tenant');

    tenancy()->end();
});

it('tool calls do not leak data across tenants', function (): void {
    $tenantA = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO A '.uniqid(),
        'owner_name' => 'Owner A',
        'owner_email' => 'hmo-a-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $tenantA->persona = 'hmo';
    $tenantA->save();

    tenancy()->initialize($tenantA);
    $userA = User::query()->firstOrFail();
    $propertyA = Property::query()->create([
        'address_line1' => 'Tenant A Only',
        'city' => 'Leeds',
        'postcode' => 'LS4 4DD',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $userA->id,
    ]);
    $propertyAId = $propertyA->id;
    tenancy()->end();

    $tenantB = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO B '.uniqid(),
        'owner_name' => 'Owner B',
        'owner_email' => 'hmo-b-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);
    $tenantB->persona = 'hmo';
    $tenantB->save();

    tenancy()->initialize($tenantB);
    $userB = User::query()->firstOrFail();
    $conversation = CarinaConversation::query()->create([
        'user_id' => $userB->id,
        'tenant_id' => $tenantB->getTenantKey(),
        'title' => 'Test',
    ]);

    $result = app(GetVoidRoomsTool::class)->execute(['property_id' => $propertyAId], $userB, $conversation);

    expect($result->success)->toBeFalse()
        ->and($result->error)->toBe('not_found');

    tenancy()->end();
});
