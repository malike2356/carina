<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\Room;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function makeHmoProperty(User $user): Property
{
    return Property::query()->create([
        'address_line1' => '10 HMO Street',
        'city'          => 'Birmingham',
        'postcode'      => 'B1 1AA',
        'property_type' => 'hmo',
        'strategy'      => 'hmo',
        'status'        => 'managing',
        'created_by'    => $user->id,
    ]);
}

it('can add a room to an HMO property', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Rooms Test '.uniqid(),
        'owner_name'   => 'Owner',
        'owner_email'  => 'owner-'.uniqid().'@rooms.test',
        'plan'         => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoProperty($user);
    tenancy()->end();

    $response = $this->actingAs($user, 'web')
        ->withServerVariables(['HTTP_HOST' => $host])
        ->post("/properties/{$property->id}/rooms", [
            'name'      => 'Room 1',
            'room_type' => 'double',
            'status'    => 'available',
            'rent_pcm'  => 650,
        ]);

    tenancy()->initialize($tenant);
    expect(Room::query()->where('property_id', $property->id)->where('name', 'Room 1')->exists())->toBeTrue();
    tenancy()->end();

    $response->assertRedirect();
});

it('can update a room', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room Update '.uniqid(),
        'owner_name'   => 'Owner',
        'owner_email'  => 'owner-'.uniqid().'@rooms-update.test',
        'plan'         => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoProperty($user);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by'  => $user->id,
        'name'        => 'Room A',
        'room_type'   => 'single',
        'status'      => 'available',
        'rent_pcm'    => 500,
        'ensuite'     => false,
        'furnished'   => true,
    ]);
    tenancy()->end();

    $response = $this->actingAs($user, 'web')
        ->withServerVariables(['HTTP_HOST' => $host])
        ->put("/properties/{$property->id}/rooms/{$room->id}", [
            'name'      => 'Room A',
            'room_type' => 'double',
            'status'    => 'occupied',
            'rent_pcm'  => 625,
        ]);

    tenancy()->initialize($tenant);
    $room->refresh();
    expect($room->status)->toBe('occupied');
    expect((float) $room->rent_pcm)->toBe(625.0);
    tenancy()->end();

    $response->assertRedirect();
});

it('rejects a duplicate room name on the same property', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dup Room '.uniqid(),
        'owner_name'   => 'Owner',
        'owner_email'  => 'owner-'.uniqid().'@dup-room.test',
        'plan'         => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoProperty($user);
    Room::query()->create([
        'property_id' => $property->id,
        'created_by'  => $user->id,
        'name'        => 'Room 1',
        'room_type'   => 'single',
        'status'      => 'available',
        'ensuite'     => false,
        'furnished'   => true,
    ]);
    tenancy()->end();

    $response = $this->actingAs($user, 'web')
        ->withServerVariables(['HTTP_HOST' => $host])
        ->post("/properties/{$property->id}/rooms", [
            'name'      => 'Room 1',
            'room_type' => 'double',
            'status'    => 'available',
        ]);

    $response->assertSessionHasErrors('name');
});

it('can soft-delete a room', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Delete Room '.uniqid(),
        'owner_name'   => 'Owner',
        'owner_email'  => 'owner-'.uniqid().'@del-room.test',
        'plan'         => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoProperty($user);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by'  => $user->id,
        'name'        => 'Room X',
        'room_type'   => 'single',
        'status'      => 'available',
        'ensuite'     => false,
        'furnished'   => true,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->withServerVariables(['HTTP_HOST' => $host])
        ->delete("/properties/{$property->id}/rooms/{$room->id}")
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(Room::query()->find($room->id))->toBeNull();
    expect(Room::withTrashed()->find($room->id))->not->toBeNull();
    tenancy()->end();
});

it('returns the per-room pl view', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room PL '.uniqid(),
        'owner_name'   => 'Owner',
        'owner_email'  => 'owner-'.uniqid().'@room-pl.test',
        'plan'         => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoProperty($user);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by'  => $user->id,
        'name'        => 'Room PL',
        'room_type'   => 'single',
        'status'      => 'available',
        'rent_pcm'    => 600,
        'ensuite'     => false,
        'furnished'   => true,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->withServerVariables(['HTTP_HOST' => $host])
        ->get("/properties/{$property->id}/rooms/{$room->id}/pl")
        ->assertOk()
        ->assertViewIs('tenant.properties.rooms.pl');
});
