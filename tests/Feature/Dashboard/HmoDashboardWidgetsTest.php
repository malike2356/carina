<?php

declare(strict_types=1);

use App\Models\Tenant\DashboardWidget;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\Room;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Reporting\DashboardWidgetService;
use App\Services\Reporting\HmoDashboardWidgetService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\URL;

it('shows occupancy board widget for hmo persona workspace', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Dash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-dash.test',
        'plan' => 'mentor_network',
    ]);
    $tenant->persona = 'hmo';
    $tenant->save();

    tenancy()->initialize($tenant);
    URL::defaults(['tenant_subdomain' => $tenant->domains->firstOrFail()->domain]);
    $user = User::query()->firstOrFail();

    Property::query()->create([
        'address_line1' => '1 Board Street',
        'city' => 'Leeds',
        'postcode' => 'LS2 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $widgets = app(DashboardWidgetService::class)->getWidgetData();
    $types = collect($widgets)->pluck('type')->all();

    expect($types)->toContain('occupancy_board');
    tenancy()->end();
});

it('does not show occupancy board for mixed persona without hmo properties', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mixed Dash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mixed-dash.test',
        'plan' => 'starter',
    ]);
    $tenant->persona = 'mixed';
    $tenant->save();

    tenancy()->initialize($tenant);
    URL::defaults(['tenant_subdomain' => $tenant->domains->firstOrFail()->domain]);

    DashboardWidget::query()->create([
        'type' => 'occupancy_board',
        'title' => 'Occupancy',
        'configuration' => [],
        'position' => 0,
        'is_visible' => true,
    ]);

    Property::query()->create([
        'address_line1' => '99 BTL Lane',
        'city' => 'Leeds',
        'postcode' => 'LS3 1BB',
        'property_type' => 'house',
        'strategy' => 'btl',
        'status' => 'managing',
        'created_by' => User::query()->firstOrFail()->id,
    ]);

    $types = collect(app(DashboardWidgetService::class)->getWidgetData())->pluck('type')->all();

    expect($types)->not->toContain('occupancy_board');
    tenancy()->end();
});

it('rent overdue widget returns correct count of overdue rooms', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Overdue Dash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@overdue-dash.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '5 Overdue HMO',
        'city' => 'Leeds',
        'postcode' => 'LS4 1CC',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Room A',
        'room_type' => 'single',
        'status' => 'occupied',
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'room_id' => $room->id,
        'tenant_name' => 'Jane Tenant',
        'rent_amount' => 550,
        'start_date' => now()->subMonths(2),
    ]);

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 55000,
        'due_date' => now()->subDays(5),
        'status' => 'late',
        'created_by' => $user->id,
    ]);

    $payload = app(HmoDashboardWidgetService::class)->rentOverdueByRoom();

    expect($payload['count'])->toBe(1)
        ->and($payload['total_minor'])->toBe(55000);
    tenancy()->end();
});
