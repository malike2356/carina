<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('rescored command replaces motivation fields without duplicating signals', function (): void {
    Carbon::setTestNow('2026-05-16 12:00:00');

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Motivation Rescore '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@motivation.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Rescore target',
        'metrics' => [
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/rescore',
            'asking_price' => 240000,
            'original_asking_price' => 260000,
            'notes' => 'Must sell quickly, chain free urgent.',
        ],
        'status' => 'suggested',
    ]);

    tenancy()->end();

    $this->artisan('deals:rescore-motivation', ['--tenant' => $tenant->id])
        ->assertSuccessful();

    tenancy()->initialize($tenant);
    $deal->refresh();
    $firstSignals = data_get($deal->metrics, 'motivation_signals');
    expect($firstSignals)->toBeArray()->not->toBeEmpty();

    $this->artisan('deals:rescore-motivation', ['--tenant' => $tenant->id])
        ->assertSuccessful();

    $deal->refresh();
    $secondSignals = data_get($deal->metrics, 'motivation_signals');
    expect($secondSignals)->toBe($firstSignals)
        ->and(count($secondSignals))->toBe(count(array_unique($secondSignals)));

    tenancy()->end();
    Carbon::setTestNow();
});

it('filters sourced listings by motivation band on the hub', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Motivation Filter '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@motfilter.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    DealAnalysis::query()->create([
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Low motivation listing',
        'metrics' => [
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/low',
            'motivation_score' => 0,
            'motivation_label' => 'Low motivation',
            'motivation_signals' => [],
        ],
        'status' => 'suggested',
    ]);

    DealAnalysis::query()->create([
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Highly motivated listing',
        'metrics' => [
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/high',
            'motivation_score' => 95,
            'motivation_label' => 'Highly motivated',
            'motivation_signals' => ['price_reduced', 'relisted'],
        ],
        'status' => 'suggested',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/sourcing/listings?motivation=highly_motivated')
        ->assertOk()
        ->assertSee('Highly motivated listing', false)
        ->assertDontSee('Low motivation listing', false);
});
