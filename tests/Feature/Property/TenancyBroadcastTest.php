<?php

declare(strict_types=1);

use App\Jobs\Communications\SendTenantBroadcastJob;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\User;
use App\Services\Billing\Contracts\FeatureGatingServiceInterface;
use App\Services\Property\TenancyBroadcastRecipientQuery;
use App\Services\Property\TenancyBroadcastScope;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

function enableCommunicationsHubForTests(): void
{
    $mock = Mockery::mock(FeatureGatingServiceInterface::class);
    $mock->shouldReceive('hasFeature')->andReturn(true);
    $mock->shouldReceive('getPlanFeatures')->andReturn([]);
    $mock->shouldReceive('enforceLimits')->andReturnNull();
    app()->instance(FeatureGatingServiceInterface::class, $mock);
}

it('queues a workspace-wide tenant broadcast', function () {
    Queue::fake();
    enableCommunicationsHubForTests();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Broadcast All '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@broadcast-all.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $propertyA = Property::query()->create([
        'address_line1' => 'A Road',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'buy_to_let',
        'created_by' => $user->id,
    ]);
    $propertyB = Property::query()->create([
        'address_line1' => 'B Road',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'hmo',
        'created_by' => $user->id,
    ]);

    $contactA = Contact::query()->create([
        'first_name' => 'Alex',
        'last_name' => 'Tenant',
        'email' => 'alex-'.uniqid().'@example.com',
        'created_by' => $user->id,
    ]);
    $contactB = Contact::query()->create([
        'first_name' => 'Bea',
        'last_name' => 'Tenant',
        'email' => 'bea-'.uniqid().'@example.com',
        'created_by' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $propertyA->id,
        'tenant_name' => 'Alex Tenant',
        'rent_amount' => 700,
        'start_date' => '2025-01-01',
        'contact_id' => $contactA->id,
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $propertyB->id,
        'tenant_name' => 'Bea Tenant',
        'rent_amount' => 900,
        'start_date' => '2025-02-01',
        'contact_id' => $contactB->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');
    $base = 'http://'.$host;

    $this->post($base.'/properties/tenancies/broadcast', [
        'scope' => 'all',
        'subject' => 'Portfolio notice',
        'body' => 'Hello everyone',
        'redirect_route' => 'tenancies',
    ])->assertRedirect($base.'/properties/tenancies')
        ->assertSessionHas('success');

    Queue::assertPushed(SendTenantBroadcastJob::class, function (SendTenantBroadcastJob $job) use ($tenant): bool {
        return $job->tenantCentralId === (string) $tenant->getKey()
            && $job->scopeType === TenancyBroadcastScope::ALL
            && $job->subject === 'Portfolio notice';
    });
});

it('scopes broadcast recipients to one property', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Broadcast Prop '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@broadcast-prop.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $propertyA = Property::query()->create([
        'address_line1' => 'Only Here',
        'city' => 'York',
        'postcode' => 'YO1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'buy_to_let',
        'created_by' => $user->id,
    ]);
    $propertyB = Property::query()->create([
        'address_line1' => 'Elsewhere',
        'city' => 'York',
        'postcode' => 'YO1 2BB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'buy_to_let',
        'created_by' => $user->id,
    ]);

    $contactA = Contact::query()->create([
        'first_name' => 'Only',
        'last_name' => 'Here',
        'email' => 'only-'.uniqid().'@example.com',
        'created_by' => $user->id,
    ]);
    $contactB = Contact::query()->create([
        'first_name' => 'Other',
        'last_name' => 'Place',
        'email' => 'other-'.uniqid().'@example.com',
        'created_by' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $propertyA->id,
        'tenant_name' => 'Here Tenant',
        'rent_amount' => 600,
        'start_date' => '2025-03-01',
        'contact_id' => $contactA->id,
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $propertyB->id,
        'tenant_name' => 'There Tenant',
        'rent_amount' => 650,
        'start_date' => '2025-03-01',
        'contact_id' => $contactB->id,
    ]);

    $query = app(TenancyBroadcastRecipientQuery::class);
    $scope = TenancyBroadcastScope::forProperty((int) $propertyA->id);

    expect($query->count($scope))->toBe(1)
        ->and($query->count(TenancyBroadcastScope::workspace()))->toBe(2);

    tenancy()->end();
});

it('scopes broadcast recipients to a strategy portfolio', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Broadcast Strat '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@broadcast-strat.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $btl = Property::query()->create([
        'address_line1' => 'BTL House',
        'city' => 'Hull',
        'postcode' => 'HU1 1AA',
        'property_type' => 'terraced',
        'status' => 'managing',
        'strategy' => 'buy_to_let',
        'created_by' => $user->id,
    ]);
    $hmo = Property::query()->create([
        'address_line1' => 'HMO House',
        'city' => 'Hull',
        'postcode' => 'HU1 2BB',
        'property_type' => 'terraced',
        'status' => 'managing',
        'strategy' => 'hmo',
        'created_by' => $user->id,
    ]);

    $btlContact = Contact::query()->create([
        'first_name' => 'BTL',
        'last_name' => 'One',
        'email' => 'btl-'.uniqid().'@example.com',
        'created_by' => $user->id,
    ]);
    $hmoContact = Contact::query()->create([
        'first_name' => 'HMO',
        'last_name' => 'One',
        'email' => 'hmo-'.uniqid().'@example.com',
        'created_by' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $btl->id,
        'tenant_name' => 'BTL Tenant',
        'rent_amount' => 500,
        'start_date' => '2025-04-01',
        'contact_id' => $btlContact->id,
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $hmo->id,
        'tenant_name' => 'HMO Tenant',
        'rent_amount' => 400,
        'start_date' => '2025-04-01',
        'contact_id' => $hmoContact->id,
    ]);

    $query = app(TenancyBroadcastRecipientQuery::class);

    expect($query->count(TenancyBroadcastScope::forStrategy('buy_to_let')))->toBe(1)
        ->and($query->count(TenancyBroadcastScope::forStrategy('hmo')))->toBe(1);

    tenancy()->end();
});

it('shows property-scoped message tenants on the property page', function () {
    enableCommunicationsHubForTests();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Broadcast UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@broadcast-ui.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => 'UI Street',
        'city' => 'Bath',
        'postcode' => 'BA1 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'buy_to_let',
        'created_by' => $user->id,
    ]);
    $contact = Contact::query()->create([
        'first_name' => 'UI',
        'last_name' => 'Tenant',
        'email' => 'ui-'.uniqid().'@example.com',
        'created_by' => $user->id,
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'UI Tenant',
        'rent_amount' => 800,
        'start_date' => '2025-05-01',
        'contact_id' => $contact->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/properties/'.$property->id)
        ->assertOk()
        ->assertSee('Message tenants')
        ->assertSee('property-tenancy-broadcast-modal', false);
});
