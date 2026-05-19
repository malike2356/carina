<?php

declare(strict_types=1);

use App\Enums\Tenant\ListingSourceDriver;
use App\Enums\Tenant\ListingSourceFrequency;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAlert;
use App\Models\Tenant\ListingSource;
use App\Models\Tenant\ListingSourceEvent;
use App\Models\Tenant\SourcingCriterion;
use App\Models\Tenant\User;
use App\Services\Deals\ListingEventCriterionMatcher;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

it('scores listing source events against active criteria and dedupes alerts', function (): void {
    Notification::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Matcher Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@matcher.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();

    $source = ListingSource::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'created_by' => $user->id,
        'name' => 'Manchester RSS',
        'driver' => ListingSourceDriver::Rss->value,
        'frequency' => ListingSourceFrequency::Daily->value,
        'feed_url' => 'https://example.test/feed.xml',
        'default_strategy' => 'btl',
        'consent_confirmed_at' => now(),
        'is_active' => true,
    ]);

    $criterion = SourcingCriterion::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'created_by' => $user->id,
        'name' => 'Manchester BTL',
        'max_price' => 200000,
        'min_bedrooms' => 3,
        'postcodes' => ['M1'],
        'strategy' => 'btl',
        'is_active' => true,
    ]);

    $event = ListingSourceEvent::query()->create([
        'listing_source_id' => $source->id,
        'fingerprint' => hash('sha256', 'listing-match-test'),
        'status' => 'created_deal',
        'meta' => [
            'title' => '3-bed terrace',
            'price' => 175000,
            'bedrooms' => 3,
            'postcode' => 'M1 1AA',
            'property_type' => 'terraced',
            'strategy' => 'btl',
            'source_url' => 'https://example.test/listing',
        ],
    ]);

    $matcher = app(ListingEventCriterionMatcher::class);

    expect($matcher->scoreEvent($event))->toBe(1);

    $event->refresh();

    expect($event->criteria_scored_at)->not->toBeNull()
        ->and($event->criteria_match_count)->toBe(1)
        ->and(DealAlert::query()->where('sourcing_criterion_id', $criterion->id)->where('listing_source_event_id', $event->id)->count())->toBe(1)
        ->and($matcher->scoreEvent($event))->toBe(0)
        ->and(DealAlert::query()->where('sourcing_criterion_id', $criterion->id)->where('listing_source_event_id', $event->id)->count())->toBe(1);

    tenancy()->end();
});
