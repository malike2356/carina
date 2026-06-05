<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\SelectiveLicence;
use App\Models\Tenant\SelectiveLicensingZone;
use App\Models\Tenant\User;
use App\Services\Compliance\SelectiveLicenceService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function selectiveLicenceTestContext(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Selective Licence '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@selective-licence.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '42 Licensing Lane',
        'city' => 'Nottingham',
        'postcode' => 'NG1 2AB',
        'property_type' => 'terraced',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    return [$tenant, $host, $user, $property];
}

it('creates a selective licence for a property', function (): void {
    [$tenant, $host, $user, $property] = selectiveLicenceTestContext();

    tenancy()->initialize($tenant);
    $licence = app(SelectiveLicenceService::class)->createLicence([
        'property_id' => $property->id,
        'local_authority' => 'Nottingham City Council',
        'scheme_name' => 'Nottingham Selective Licensing Scheme 2021',
        'status' => 'applied',
        'created_by_user_id' => $user->id,
    ]);
    expect($licence)->toBeInstanceOf(SelectiveLicence::class)
        ->and($licence->local_authority)->toBe('Nottingham City Council');
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/selective-licences', [
        'property_id' => $property->id,
        'local_authority' => 'Nottingham City Council',
        'scheme_name' => 'Web scheme',
        'status' => 'pending_application',
        'licence_holder_type' => 'landlord',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(SelectiveLicence::query()->where('scheme_name', 'Web scheme')->exists())->toBeTrue();
    tenancy()->end();
});

it('returns true from isRenewalDue when expiry is within renewal_reminder_days', function (): void {
    Carbon::setTestNow('2026-06-01');

    $licence = new SelectiveLicence([
        'status' => 'granted',
        'expiry_date' => '2026-07-15',
        'renewal_reminder_days' => 90,
    ]);

    expect($licence->isRenewalDue())->toBeTrue();

    Carbon::setTestNow();
});

it('returns true from matchesPostcode when postcode district is in zone list', function (): void {
    $zone = new SelectiveLicensingZone([
        'all_properties_in_area' => false,
        'postcode_districts' => ['NG1', 'NG2'],
        'is_active' => true,
    ]);

    expect($zone->matchesPostcode('NG1 2AB'))->toBeTrue()
        ->and($zone->matchesPostcode('NG9 1AA'))->toBeFalse();
});

it('returns properties in zones with no granted licence from getPropertiesRequiringLicenceCheck', function (): void {
    [$tenant, , $user, $property] = selectiveLicenceTestContext();

    tenancy()->initialize($tenant);

    SelectiveLicensingZone::query()->create([
        'local_authority_name' => 'Nottingham City Council',
        'scheme_name' => 'Nottingham Selective Licensing',
        'postcode_districts' => ['NG1'],
        'all_properties_in_area' => false,
        'is_active' => true,
    ]);

    Property::query()->create([
        'address_line1' => '99 Outside Area',
        'city' => 'Derby',
        'postcode' => 'DE1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);

    $requiring = app(SelectiveLicenceService::class)->getPropertiesRequiringLicenceCheck();

    expect($requiring)->toHaveCount(1)
        ->and($requiring->first()->id)->toBe($property->id);

    app(SelectiveLicenceService::class)->createLicence([
        'property_id' => $property->id,
        'local_authority' => 'Nottingham City Council',
        'status' => 'granted',
        'expiry_date' => now()->addYear()->toDateString(),
    ]);

    expect(app(SelectiveLicenceService::class)->getPropertiesRequiringLicenceCheck())->toHaveCount(0);

    tenancy()->end();
});
