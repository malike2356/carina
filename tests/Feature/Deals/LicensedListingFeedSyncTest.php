<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\DealAlert;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Property;
use App\Models\Tenant\SourcingCriterion;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('syncs licensed feed batch into property and deal', function (): void {
    Http::fake([
        'https://feed.adapter.test/v1/workspaces/*' => Http::response([
            'items' => [
                [
                    'title' => 'Feed listing one',
                    'address' => '10 Test Street, Manchester',
                    'postcode' => 'M1 1AA',
                    'price' => 175000,
                    'bedrooms' => 2,
                    'bathrooms' => 1,
                    'property_type' => 'flat',
                    'listingUrl' => 'https://www.rightmove.co.uk/properties/55555555',
                    'rightmove_property_id' => '55555555',
                    'photos' => ['https://licensed.cdn.example/1.jpg'],
                ],
            ],
        ], 200),
    ]);

    config([
        'listings.ingestion.poll_enabled' => true,
        'listings.ingestion.batch_poll_url' => 'https://feed.adapter.test/v1/workspaces/{tenant_id}/listings',
        'listings.ingestion.batch_poll_method' => 'GET',
        'listings.ingestion.batch_bearer_token' => null,
        'listings.ingestion.max_items_per_run' => 50,
        'listings.ingestion.default_strategy' => 'btl',
        'listings.ingestion.deal_status' => 'draft',
        'listings.ingestion.default_actor_user_id' => null,
    ]);

    $svc = app(TenantCreationService::class);
    $tenant = $svc->createTenant([
        'company_name' => 'Feed Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@feed.test',
        'plan' => 'starter',
    ]);

    $tenant = Tenant::query()->with('domains')->findOrFail($tenant->getKey());
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    SourcingCriterion::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'created_by' => $user->id,
        'name' => 'Licensed feed patch',
        'strategy' => 'btl',
        'postcodes' => ['M1'],
        'is_active' => true,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->postJson('http://'.$host.'/deals/sourcing/licensed-feed/sync', ['confirm' => true]);

    $response->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('stats.created', 1);

    tenancy()->initialize($tenant);
    $property = Property::query()->where('rightmove_id', '55555555')->first();
    expect($property)->not->toBeNull()
        ->and($property->source)->toBe('licensed_feed')
        ->and(DealAnalysis::query()->where('property_id', $property->id)->count())->toBe(1)
        ->and(DealAlert::query()
            ->where('created_by', $user->id)
            ->where('criteria->source', 'partner_feed_match')
            ->where('criteria->property_id', $property->id)
            ->exists())->toBeTrue();
    tenancy()->end();

    Http::assertSent(function ($request) use ($tenant): bool {
        return str_contains($request->url(), 'https://feed.adapter.test/v1/workspaces/'.$tenant->getKey().'/listings');
    });
});
