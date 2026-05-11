<?php

declare(strict_types=1);

use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('creates a draft deal from extension capture with sanctum token', function () {
    Http::preventStrayRequests();

    $jsonLd = json_encode([
        '@context' => 'https://schema.org',
        '@type' => 'Product',
        'name' => 'Extension capture test',
        'description' => 'Test listing.',
        'offers' => ['price' => 199000],
        'image' => ['https://example.com/img.jpg'],
        'address' => [
            'streetAddress' => '1 Extension Road',
            'addressLocality' => 'Leeds',
            'postalCode' => 'LS1 1AA',
        ],
        'numberOfRooms' => 2,
    ]);
    assert(is_string($jsonLd));

    Http::fake([
        'https://www.rightmove.co.uk/properties/77701' => Http::response(
            '<html><head><script type="application/ld+json">'.$jsonLd.'</script></head><body></body></html>',
            200,
        ),
    ]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Ext Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@ext.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $plain = $user->createToken('propreneur-extension:test')->plainTextToken;
    tenancy()->end();

    $response = $this->postJson('http://'.$host.'/api/deal-extension-capture', [
        'url' => 'https://www.rightmove.co.uk/properties/77701',
        'strategy' => 'btl',
    ], [
        'Authorization' => 'Bearer '.$plain,
    ]);

    $response->assertOk()
        ->assertJsonPath('data.status', 'created_deal');

    tenancy()->initialize($tenant);
    expect(DealAnalysis::query()->count())->toBe(1)
        ->and(DealAnalysis::query()->first()->status)->toBe('draft');
    tenancy()->end();
});
