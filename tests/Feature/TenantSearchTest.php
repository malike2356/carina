<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

it('returns tenant-scoped search hits for properties', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Search Workspace '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@tenant-search.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();

    Property::query()->create([
        'address_line1' => 'UniqueSearchRoad 42',
        'city' => 'Manchester',
        'postcode' => 'M1 1AE',
        'property_type' => 'terraced',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    completeTenantWorkspaceOnboarding();

    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->getJson('http://'.$host.'/search?q='.urlencode('UniqueSearch'));

    $response->assertOk();

    $urls = collect($response->json('results'))->pluck('url');

    expect($urls->contains(fn ($url) => str_contains((string) $url, '/properties/')))->toBeTrue();
});
