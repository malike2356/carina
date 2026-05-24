<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\Room;
use App\Models\Tenant\User;
use App\Services\Properties\RoomService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

function roomSizeProperty(User $user): Property
{
    return Property::query()->create([
        'address_line1' => '8 Size Street',
        'city' => 'Manchester',
        'postcode' => 'M3 3CC',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
}

it('flags room below 6.51sqm for single occupant as non-compliant', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room Size '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@room-size.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $room = Room::query()->create([
        'property_id' => roomSizeProperty($user)->id,
        'created_by' => $user->id,
        'name' => 'Small room',
        'room_type' => 'single',
        'status' => 'available',
        'floor_area_sqm' => 6.0,
        'occupant_type' => 'single',
    ]);

    app(RoomService::class)->persistSizeCompliance($room);
    $room->refresh();

    expect($room->size_compliant)->toBeFalse()
        ->and(app(RoomService::class)->checkSizeCompliance($room))->toBeFalse()
        ->and(app(RoomService::class)->flagNonCompliantRooms($room->property)->pluck('id'))->toContain($room->id);

    tenancy()->end();
});

it('marks room above minimum as compliant', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room OK '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@room-ok.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $room = Room::query()->create([
        'property_id' => roomSizeProperty($user)->id,
        'created_by' => $user->id,
        'name' => 'Good room',
        'room_type' => 'double',
        'status' => 'available',
        'floor_area_sqm' => 11.5,
        'occupant_type' => 'double',
    ]);

    app(RoomService::class)->persistSizeCompliance($room);
    $room->refresh();

    expect($room->size_compliant)->toBeTrue()
        ->and(app(RoomService::class)->checkSizeCompliance($room))->toBeTrue();

    tenancy()->end();
});

it('null floor area does not set size_compliant to false', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room Null '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@room-null.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $room = Room::query()->create([
        'property_id' => roomSizeProperty($user)->id,
        'created_by' => $user->id,
        'name' => 'Unknown size',
        'room_type' => 'single',
        'status' => 'available',
        'floor_area_sqm' => null,
        'occupant_type' => 'single',
    ]);

    app(RoomService::class)->persistSizeCompliance($room);
    $room->refresh();

    expect($room->size_compliant)->toBeNull()
        ->and(app(RoomService::class)->flagNonCompliantRooms($room->property))->toBeEmpty();

    tenancy()->end();
});
