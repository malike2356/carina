<?php

declare(strict_types=1);

use App\Models\Central\SubscriptionPlan;
use App\Models\Central\Tenant;
use App\Models\Tenant\Property;
use App\Models\Tenant\Room;
use App\Models\Tenant\User;
use App\Services\Billing\SubscriptionService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\SubscriptionPlanSeeder;
use Illuminate\Support\Facades\Artisan;

beforeEach(function (): void {
    $this->seed(SubscriptionPlanSeeder::class);
});

it('charges surcharge when room count exceeds included rooms on plan', function (): void {
    SubscriptionPlan::on('central')->where('slug', 'operator')->update([
        'included_rooms' => 5,
        'price_per_additional_room' => '3.00',
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room Pricing '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'rooms-'.uniqid().'@pricing.test',
        'plan' => 'operator',
    ]);

    Tenant::on('central')->whereKey($tenant->id)->update(['room_count' => 10]);

    $surcharge = app(SubscriptionService::class)->calculateRoomSurcharge(
        Tenant::on('central')->findOrFail($tenant->id)
    );

    expect($surcharge)->toBe(15.0);
});

it('charges no surcharge when room count is within included allowance', function (): void {
    SubscriptionPlan::on('central')->where('slug', 'operator')->update([
        'included_rooms' => 5,
        'price_per_additional_room' => '3.00',
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room Pricing Low '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'rooms-low-'.uniqid().'@pricing.test',
        'plan' => 'operator',
    ]);

    Tenant::on('central')->whereKey($tenant->id)->update(['room_count' => 3]);

    $surcharge = app(SubscriptionService::class)->calculateRoomSurcharge(
        Tenant::on('central')->findOrFail($tenant->id)
    );

    expect($surcharge)->toBe(0.0);
});

it('sync command updates tenants room_count from tenant database', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Room Sync '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'rooms-sync-'.uniqid().'@pricing.test',
        'plan' => 'operator',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '1 Sync Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    foreach (range(1, 7) as $i) {
        Room::query()->create([
            'property_id' => $property->id,
            'created_by' => $user->id,
            'name' => 'Room '.$i,
            'room_type' => 'single',
            'status' => 'available',
        ]);
    }
    tenancy()->end();

    Artisan::call('billing:sync-tenant-room-count', ['--tenant' => $tenant->id]);

    $fresh = Tenant::on('central')->findOrFail($tenant->id);
    expect($fresh->room_count)->toBe(7)
        ->and($fresh->room_count_synced_at)->not->toBeNull();
});
