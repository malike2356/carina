<?php

declare(strict_types=1);

use App\Models\Tenant\CommunalAreaInspection;
use App\Models\Tenant\ComplianceScore;
use App\Models\Tenant\Property;
use App\Models\Tenant\Room;
use App\Models\Tenant\User;
use App\Notifications\Tenant\HmoLicenceRenewalNotification;
use App\Services\Properties\FireSafetyService;
use App\Services\Properties\HmoComplianceService;
use App\Services\Properties\RoomService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function makeHmoPropertyForCompliance(User $user, array $overrides = []): Property
{
    return Property::query()->create(array_merge([
        'address_line1' => '20 Compliance Lane',
        'city' => 'Manchester',
        'postcode' => 'M1 2AB',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'hmo_license_required' => true,
        'created_by' => $user->id,
    ], $overrides));
}

it('calculateScore returns correct RAG status given cert expiry dates', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Compliance '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-compliance.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user, [
        'epc_expiry' => now()->addDays(120),
        'hmo_license_expiry' => now()->addDays(15),
    ]);

    $property->complianceItems()->createMany([
        [
            'created_by' => $user->id,
            'category' => 'safety',
            'type' => 'gas_safety',
            'title' => 'Gas Safety',
            'expires_at' => now()->addDays(200),
            'status' => 'valid',
        ],
        [
            'created_by' => $user->id,
            'category' => 'safety',
            'type' => 'eicr',
            'title' => 'EICR',
            'expires_at' => now()->addDays(45),
            'status' => 'valid',
        ],
        [
            'created_by' => $user->id,
            'category' => 'safety',
            'type' => 'fire_alarm',
            'title' => 'Fire alarm',
            'expires_at' => now()->subDay(),
            'status' => 'expired',
        ],
    ]);

    $score = app(HmoComplianceService::class)->calculateScore($property->fresh(['complianceItems', 'tenancies']));

    expect($score->breakdown['gas_safety']['status'])->toBe('green')
        ->and($score->breakdown['gas_safety']['score'])->toBe(100)
        ->and($score->breakdown['eicr']['status'])->toBe('amber')
        ->and($score->breakdown['hmo_licence']['status'])->toBe('red')
        ->and($score->breakdown['fire_safety']['score'])->toBe(0)
        ->and($score->status)->toBeIn(['amber', 'red']);

    tenancy()->end();
});

it('daily scorer command creates a snapshot per HMO property', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Scorer '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-scorer.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    makeHmoPropertyForCompliance($user);
    makeHmoPropertyForCompliance($user, ['address_line1' => '22 Second HMO']);
    Property::query()->create([
        'address_line1' => '1 BTL House',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'strategy' => 'btl',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    expect(ComplianceScore::query()->count())->toBe(0);
    tenancy()->end();

    Artisan::call('nexio:hmo-compliance-score');

    tenancy()->initialize($tenant);
    expect(ComplianceScore::query()->count())->toBe(2);
    tenancy()->end();
});

it('renewal reminder fires at 90-day threshold', function (): void {
    Notification::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Renewal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-renewal.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    makeHmoPropertyForCompliance($user, [
        'hmo_license_expiry' => now()->addDays(90)->startOfDay(),
    ]);

    tenancy()->end();

    $sent = 0;
    tenancy()->initialize($tenant);
    $sent = app(HmoComplianceService::class)->checkLicenceRenewals();
    tenancy()->end();

    expect($sent)->toBeGreaterThan(0);

    Notification::assertSentTo(
        $user,
        HmoLicenceRenewalNotification::class,
        fn (HmoLicenceRenewalNotification $notification): bool => $notification->daysUntilExpiry === 90
    );
});

it('room_size breakdown is red when any room is below minimum size', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Room Red '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-room-red.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Small room',
        'room_type' => 'single',
        'status' => 'available',
        'floor_area_sqm' => 6.0,
        'occupant_type' => 'single',
    ]);
    app(RoomService::class)->persistSizeCompliance($room);

    $score = app(HmoComplianceService::class)->calculateScore($property->fresh(['rooms']));

    expect($score->breakdown['room_size']['status'])->toBe('red')
        ->and($score->breakdown['room_size']['score'])->toBe(0);

    tenancy()->end();
});

it('room_size breakdown is amber when floor area is missing on a room', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Room Amber '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-room-amber.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);
    Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Measured room',
        'room_type' => 'single',
        'status' => 'available',
        'floor_area_sqm' => 7.0,
        'occupant_type' => 'single',
        'size_compliant' => true,
    ]);
    Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Unknown size',
        'room_type' => 'single',
        'status' => 'available',
        'floor_area_sqm' => null,
        'occupant_type' => 'single',
        'size_compliant' => null,
    ]);

    $score = app(HmoComplianceService::class)->calculateScore($property->fresh(['rooms']));

    expect($score->breakdown['room_size']['status'])->toBe('amber')
        ->and($score->breakdown['room_size']['score'])->toBe(80);

    tenancy()->end();
});

it('room_size breakdown is green when all rooms are measured and compliant', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Room Green '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-room-green.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);
    $room = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Compliant room',
        'room_type' => 'double',
        'status' => 'available',
        'floor_area_sqm' => 11.5,
        'occupant_type' => 'double',
    ]);
    app(RoomService::class)->persistSizeCompliance($room);

    $score = app(HmoComplianceService::class)->calculateScore($property->fresh(['rooms']));

    expect($score->breakdown['room_size']['status'])->toBe('green')
        ->and($score->breakdown['room_size']['score'])->toBe(100);

    tenancy()->end();
});

it('communal_areas breakdown is amber when no inspections are recorded', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Communal Amber '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-communal-amber.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);

    $score = app(HmoComplianceService::class)->calculateScore($property);

    expect($score->breakdown['communal_areas']['status'])->toBe('amber')
        ->and($score->breakdown['communal_areas']['score'])->toBe(80);

    tenancy()->end();
});

it('communal_areas breakdown is amber when inspection is overdue by less than 30 days', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Communal Mild '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-communal-mild.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);
    CommunalAreaInspection::query()->create([
        'property_id' => $property->id,
        'area_type' => 'kitchen',
        'inspected_at' => now()->subDays(100),
        'result' => CommunalAreaInspection::RESULT_SATISFACTORY,
        'next_due_at' => now()->subDays(10),
        'created_by' => $user->id,
    ]);

    $score = app(HmoComplianceService::class)->calculateScore($property);

    expect($score->breakdown['communal_areas']['status'])->toBe('amber')
        ->and($score->breakdown['communal_areas']['score'])->toBe(80);

    tenancy()->end();
});

it('communal_areas breakdown is red when inspection is overdue by 30 days or more', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Communal Red '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-communal-red.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);
    CommunalAreaInspection::query()->create([
        'property_id' => $property->id,
        'area_type' => 'hallway',
        'inspected_at' => now()->subDays(130),
        'result' => CommunalAreaInspection::RESULT_SATISFACTORY,
        'next_due_at' => now()->subDays(35),
        'created_by' => $user->id,
    ]);

    $score = app(HmoComplianceService::class)->calculateScore($property);

    expect($score->breakdown['communal_areas']['status'])->toBe('red')
        ->and($score->breakdown['communal_areas']['score'])->toBe(0);

    tenancy()->end();
});

it('communal_areas breakdown is red when latest inspection result is action_required', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Communal Action '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-communal-action.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);
    app(FireSafetyService::class)->logCommunalInspection($property, [
        'area_type' => 'bathroom',
        'inspected_at' => now()->toDateString(),
        'result' => CommunalAreaInspection::RESULT_ACTION_REQUIRED,
    ], $user);

    $score = app(HmoComplianceService::class)->calculateScore($property);

    expect($score->breakdown['communal_areas']['status'])->toBe('red')
        ->and($score->breakdown['communal_areas']['score'])->toBe(0);

    tenancy()->end();
});

it('communal_areas breakdown is green when inspections are up to date', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Communal Green '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-communal-green.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = makeHmoPropertyForCompliance($user);
    app(FireSafetyService::class)->logCommunalInspection($property, [
        'area_type' => 'kitchen',
        'inspected_at' => now()->subDays(5)->toDateString(),
        'result' => CommunalAreaInspection::RESULT_SATISFACTORY,
    ], $user);

    $score = app(HmoComplianceService::class)->calculateScore($property);

    expect($score->breakdown['communal_areas']['status'])->toBe('green')
        ->and($score->breakdown['communal_areas']['score'])->toBe(100);

    tenancy()->end();
});

it('can view HMO compliance page and rescore', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Page '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-page.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $property = makeHmoPropertyForCompliance($user);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/properties/'.$property->id.'/hmo-compliance')
        ->assertOk()
        ->assertViewIs('tenant.properties.hmo-compliance.show');

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/properties/'.$property->id.'/hmo-compliance/rescore')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(ComplianceScore::query()->where('property_id', $property->id)->count())->toBe(1);
    tenancy()->end();
});
