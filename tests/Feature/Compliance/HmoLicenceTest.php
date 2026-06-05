<?php

declare(strict_types=1);

use App\Models\Tenant\HmoLicence;
use App\Models\Tenant\HmoLicenceCondition;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Compliance\HmoLicenceService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
});

function hmoLicenceTestTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'HMO Licence '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hmo-licence.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

function makeHmoLicenceProperty(User $user, array $overrides = []): Property
{
    return Property::query()->create(array_merge([
        'address_line1' => '10 Licence Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ], $overrides));
}

it('creates a licence for a property', function (): void {
    [$tenant, $host, $user] = hmoLicenceTestTenant();

    tenancy()->initialize($tenant);
    $property = makeHmoLicenceProperty($user);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/hmo-licences', [
        'property_id' => $property->id,
        'licence_type' => 'mandatory',
        'local_authority' => 'Leeds City Council',
        'status' => 'applied',
        'application_date' => '2026-01-15',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $licence = HmoLicence::query()->where('property_id', $property->id)->first();
    expect($licence)->not->toBeNull()
        ->and($licence->licence_type)->toBe('mandatory')
        ->and($licence->local_authority)->toBe('Leeds City Council')
        ->and($licence->status)->toBe('applied');
    tenancy()->end();
});

it('returns true from isRenewalDue when expiry is within renewal_reminder_days', function (): void {
    [$tenant,, $user] = hmoLicenceTestTenant();

    tenancy()->initialize($tenant);
    $property = makeHmoLicenceProperty($user);
    $licence = HmoLicence::query()->create([
        'property_id' => $property->id,
        'licence_type' => 'mandatory',
        'local_authority' => 'Leeds City Council',
        'status' => 'granted',
        'issued_date' => now()->subYear(),
        'expiry_date' => now()->addDays(45),
        'renewal_reminder_days' => 90,
        'created_by_user_id' => $user->id,
    ]);
    tenancy()->end();

    tenancy()->initialize($tenant);
    expect($licence->fresh()->isRenewalDue())->toBeTrue();
    tenancy()->end();
});

it('sets met_date and status met when meetCondition is called', function (): void {
    [$tenant,, $user] = hmoLicenceTestTenant();

    tenancy()->initialize($tenant);
    $property = makeHmoLicenceProperty($user);
    $licence = HmoLicence::query()->create([
        'property_id' => $property->id,
        'licence_type' => 'mandatory',
        'local_authority' => 'Leeds City Council',
        'status' => 'granted',
        'created_by_user_id' => $user->id,
    ]);
    $condition = HmoLicenceCondition::query()->create([
        'hmo_licence_id' => $licence->id,
        'description' => 'Install fire doors to all bedrooms',
        'category' => 'fire_safety',
        'status' => 'pending',
    ]);
    tenancy()->end();

    tenancy()->initialize($tenant);
    $metDate = Carbon::parse('2026-03-01');
    app(HmoLicenceService::class)->meetCondition($condition, $metDate, 'Photos uploaded', null);
    $condition->refresh();
    expect($condition->status)->toBe('met')
        ->and($condition->met_date?->toDateString())->toBe('2026-03-01')
        ->and($condition->evidence_notes)->toBe('Photos uploaded');
    tenancy()->end();
});

it('returns false from isOccupancyWithinLimit when occupancy exceeds max_occupants', function (): void {
    [$tenant,, $user] = hmoLicenceTestTenant();

    tenancy()->initialize($tenant);
    $property = makeHmoLicenceProperty($user);
    $licence = HmoLicence::query()->create([
        'property_id' => $property->id,
        'licence_type' => 'mandatory',
        'local_authority' => 'Leeds City Council',
        'status' => 'granted',
        'max_occupants' => 2,
        'created_by_user_id' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant One',
        'start_date' => now()->subMonth(),
        'rent_amount' => 500,
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant Two',
        'start_date' => now()->subMonth(),
        'rent_amount' => 500,
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant Three',
        'start_date' => now()->subMonth(),
        'rent_amount' => 500,
    ]);

    $service = app(HmoLicenceService::class);
    expect($service->getCurrentOccupancy($licence))->toBe(3)
        ->and($service->isOccupancyWithinLimit($licence))->toBeFalse();
    tenancy()->end();
});
