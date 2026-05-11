<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\ListingSource;
use App\Models\Tenant\User;
use App\Services\Deals\RssListingSourcePoller;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('creates a draft deal from inbound json', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'BYO Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@byo.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $source = ListingSource::query()->create([
        'tenant_id' => tenant()?->getTenantKey(),
        'created_by' => $user->id,
        'name' => 'Webhook test',
        'driver' => 'webhook',
        'frequency' => 'manual',
        'feed_url' => null,
        'default_strategy' => 'btl',
        'consent_confirmed_at' => now(),
        'is_active' => true,
    ]);

    $token = $source->public_inbound_token;
    tenancy()->end();

    $payload = [
        'listings' => [
            [
                'title' => 'Test row',
                'address' => '1 Test Street, Manchester',
                'postcode' => 'M1 1AE',
                'price' => 250000,
                'bedrooms' => 2,
                'source_url' => 'https://example.com/listing/1',
            ],
        ],
    ];

    $response = $this->postJson('http://'.$host.'/listing-sources/inbound/'.$token, $payload);
    $response->assertOk()->assertJsonPath('data.results.0.status', 'created_deal');

    tenancy()->initialize($tenant);
    expect(DealAnalysis::query()->count())->toBe(1)
        ->and(DealAnalysis::query()->first()->title)->toContain('Test');
    tenancy()->end();
});

it('rejects json when signing secret is wrong', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'BYO Sign '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@byo.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $source = ListingSource::query()->create([
        'tenant_id' => tenant()?->getTenantKey(),
        'created_by' => $user->id,
        'name' => 'Signed',
        'driver' => 'webhook',
        'frequency' => 'manual',
        'default_strategy' => 'btl',
        'consent_confirmed_at' => now(),
        'is_active' => true,
        'webhook_signing_secret' => 'correct-secret',
    ]);

    $token = $source->public_inbound_token;
    tenancy()->end();

    $body = json_encode(['listings' => [['title' => 'X', 'postcode' => 'B1 1AA', 'address' => 'A', 'source_url' => 'https://example.com/x', 'price' => 1]]]);
    assert(is_string($body));

    $this->postJson('http://'.$host.'/listing-sources/inbound/'.$token, json_decode($body, true), [
        'X-Propreneur-Signature' => 'bad',
    ])->assertStatus(401);
});

it('polls rss feed into a draft deal', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'BYO RSS '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@byo.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $xml = '<?xml version="1.0"?><rss version="2.0"><channel><item>'
        .'<title>City flat</title>'
        .'<link>https://example.com/item/99</link>'
        .'<description>Guide £240000 two bed near M1 1AE</description>'
        .'</item></channel></rss>';

    Http::fake([
        'https://feeds.example.com/listings.xml' => Http::response($xml, 200),
    ]);

    $source = ListingSource::query()->create([
        'tenant_id' => tenant()?->getTenantKey(),
        'created_by' => $user->id,
        'name' => 'RSS',
        'driver' => 'rss',
        'frequency' => 'daily',
        'feed_url' => 'https://feeds.example.com/listings.xml',
        'default_strategy' => 'btl',
        'consent_confirmed_at' => now(),
        'is_active' => true,
    ]);

    app(RssListingSourcePoller::class)->poll($source);

    expect(DealAnalysis::query()->count())->toBe(1);
    tenancy()->end();
});

it('creates a Carina conversation with listing source help metadata', function () {
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'BYO Carina '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@byo-carina.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/carina/open-listing-sources/create')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $conv = CarinaConversation::query()->where('user_id', $user->id)->latest('id')->first();
    expect($conv)->not->toBeNull()
        ->and($conv->metadata['listing_sources_help'] ?? null)->toBeTrue()
        ->and($conv->metadata['surface'] ?? null)->toBe('create');
    tenancy()->end();
});
