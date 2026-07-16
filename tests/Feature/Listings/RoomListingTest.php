<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Property;
use App\Models\Tenant\Room;
use App\Models\Tenant\RoomListing;
use App\Models\Tenant\User;
use App\Services\Properties\RoomService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
});

it('creates a listing linked to room and property', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Listings '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'listings-'.uniqid().'@test.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '42 Listing Lane',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Room A',
        'room_type' => 'double',
        'status' => 'available',
        'rent_pcm' => 550,
    ]);
    FeatureFlag::query()->where('key', 'multi_property')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $this->actingAs($user, 'web')
        ->post("http://{$host}/listings/rooms", [
            'room_id' => $room->id,
            'title' => 'Double room in Leeds',
            'description' => 'Bright double room.',
            'monthly_rent' => 550,
            'status' => 'active',
        ])
        ->assertRedirect();

    $listing = RoomListing::query()->first();
    expect($listing)->not->toBeNull()
        ->and((int) $listing->room_id)->toBe((int) $room->id)
        ->and((int) $listing->property_id)->toBe((int) $property->id)
        ->and($listing->status)->toBe('active');

    tenancy()->end();
});

it('marks linked listing filled when room becomes occupied', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Occ Sync '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'occ-'.uniqid().'@test.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '1 Sync Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Room B',
        'room_type' => 'single',
        'status' => 'available',
    ]);
    $listing = RoomListing::query()->create([
        'room_id' => $room->id,
        'property_id' => $property->id,
        'title' => 'Single room',
        'status' => 'active',
        'created_by' => $user->id,
    ]);

    app(RoomService::class)->updateRoom($room, ['status' => 'occupied']);

    expect($listing->fresh()->status)->toBe('filled');
    tenancy()->end();
});
