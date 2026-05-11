<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Property\PropertyService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('duplicates a property via PropertyService', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Dup Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dup.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Test Street',
        'city' => 'London',
        'postcode' => 'SW1A 1AA',
        'property_type' => 'flat',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    $clone = app(PropertyService::class)->duplicate($property, $user);

    expect(Property::query()->count())->toBe(2)
        ->and($clone->address_line1)->toBe('1 Test Street (copy)');

    tenancy()->end();
});
