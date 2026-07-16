<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\Room;
use App\Models\Tenant\RoomStatusHistory;
use App\Models\Tenant\User;
use App\Services\Properties\OccupancyBoardService;
use App\Services\Properties\RoomService;
use App\Services\Properties\VoidAnalyticsService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\URL;

beforeEach(function (): void {
    $this->tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Void Track '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'void-'.uniqid().'@test.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);
    tenancy()->initialize($this->tenant);
    URL::defaults(['tenant_subdomain' => $this->tenant->domains->firstOrFail()->domain]);
    $this->user = User::query()->where('email', $this->tenant->owner_email)->firstOrFail();
});

afterEach(function (): void {
    tenancy()->end();
});

function voidTrackingHmoProperty(User $user, array $overrides = []): Property
{
    return Property::query()->create(array_merge([
        'address_line1' => '10 Void Street',
        'city' => 'Leeds',
        'postcode' => 'LS10 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ], $overrides));
}

it('closes status history when room moves from available to occupied', function (): void {
    $property = voidTrackingHmoProperty($this->user);
    $room = app(RoomService::class)->createRoom($property, [
        'name' => 'Room 1',
        'status' => 'available',
    ], $this->user->id);

    $open = RoomStatusHistory::query()
        ->where('room_id', $room->id)
        ->whereNull('ended_at')
        ->first();

    expect($open)->not->toBeNull()
        ->and($open->status)->toBe('available');

    app(RoomService::class)->updateRoom($room, ['status' => 'occupied']);

    $closedAvailable = RoomStatusHistory::query()
        ->where('room_id', $room->id)
        ->where('status', 'available')
        ->first();

    $openOccupied = RoomStatusHistory::query()
        ->where('room_id', $room->id)
        ->whereNull('ended_at')
        ->first();

    expect($closedAvailable->ended_at)->not->toBeNull()
        ->and($closedAvailable->duration_days)->toBeGreaterThanOrEqual(0)
        ->and($openOccupied->status)->toBe('occupied');
});

it('calculates void loss for thirty days at six hundred per month', function (): void {
    $property = voidTrackingHmoProperty($this->user);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $this->user->id,
        'name' => 'Void Room',
        'room_type' => 'single',
        'status' => 'void',
        'rent_pcm' => 600,
    ]);

    $started = now()->subDays(29)->startOfDay();
    $ended = now()->startOfDay();
    RoomStatusHistory::query()->create([
        'room_id' => $room->id,
        'status' => 'void',
        'started_at' => $started,
        'ended_at' => $ended,
        'duration_days' => 30,
    ]);

    $rows = app(VoidAnalyticsService::class)->voidLossByRoom(
        $property->load('rooms'),
        $started,
        $ended
    );

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['void_days'])->toBeGreaterThanOrEqual(30)
        ->and($rows[0]['loss'])->toEqual(600.0);
});

it('groups occupancy board rooms by property address', function (): void {
    $propA = voidTrackingHmoProperty($this->user, ['address_line1' => 'AAA First']);
    $propB = voidTrackingHmoProperty($this->user, ['address_line1' => 'ZZZ Second']);

    app(RoomService::class)->createRoom($propA, ['name' => 'A1', 'status' => 'occupied'], $this->user->id);
    app(RoomService::class)->createRoom($propA, ['name' => 'A2', 'status' => 'void'], $this->user->id);
    app(RoomService::class)->createRoom($propB, ['name' => 'B1', 'status' => 'available'], $this->user->id);

    $board = app(OccupancyBoardService::class)->buildBoard();

    expect($board['portfolio']['total_rooms'])->toBe(3)
        ->and($board['properties'])->toHaveCount(2)
        ->and($board['properties'][0]['property']->address_line1)->toBe('AAA First')
        ->and($board['properties'][0]['rooms'])->toHaveCount(2)
        ->and($board['properties'][1]['property']->address_line1)->toBe('ZZZ Second')
        ->and($board['properties'][1]['rooms'])->toHaveCount(1);
});
