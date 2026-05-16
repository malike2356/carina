<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaService;
use App\Services\Property\SaPerformanceService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->whereIn('key', ['multi_property', 'reporting_intelligence'])->update(['enabled' => true]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('saves SA metrics for a property', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SA Perf '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sa-perf.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '12 Short Let Lane',
        'city' => 'Bristol',
        'postcode' => 'BS1 4ST',
        'property_type' => 'flat',
        'strategy' => 'sa',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->put('http://'.$host.'/properties/'.$property->id.'/sa-performance', [
        'occupancy_rate_30d' => 72.5,
        'avg_nightly_rate' => 125.50,
        'revenue_ytd' => 18500,
        'airbnb_quality_score' => 4.85,
        'reviews_last_30d' => 3,
        'review_count_total' => 48,
        'is_guest_favorite' => '1',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $property->refresh();
    expect($property->sa_metrics)->toBeArray()
        ->and($property->sa_metrics['occupancy_rate_30d'])->toEqual(72.5)
        ->and($property->sa_metrics['avg_nightly_rate'])->toBe(12550)
        ->and($property->sa_metrics['revenue_ytd'])->toBe(1850000)
        ->and($property->sa_metrics['reviews_last_30d'])->toBe(3)
        ->and($property->sa_metrics['is_guest_favorite'])->toBeTrue();
    tenancy()->end();
});

it('returns portfolio rows for properties with sa metrics populated', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SA Port '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sa-port.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    Property::query()->create([
        'address_line1' => 'Low Revenue',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'strategy' => 'sa',
        'status' => 'managing',
        'created_by' => $user->id,
        'sa_metrics' => [
            'revenue_ytd' => 1000000,
            'occupancy_rate_30d' => 55,
            'reviews_last_30d' => 2,
            'updated_at' => now()->toIso8601String(),
        ],
    ]);

    Property::query()->create([
        'address_line1' => 'High Revenue',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'house',
        'strategy' => 'btl',
        'status' => 'managing',
        'created_by' => $user->id,
        'sa_metrics' => [
            'revenue_ytd' => 3000000,
            'occupancy_rate_30d' => 80,
            'reviews_last_30d' => 5,
            'updated_at' => now()->toIso8601String(),
        ],
    ]);

    Property::query()->create([
        'address_line1' => 'No Metrics',
        'city' => 'Leeds',
        'postcode' => 'LS3 3CC',
        'property_type' => 'flat',
        'strategy' => 'sa',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/reporting/sa-portfolio');
    $response->assertOk()
        ->assertSee('High Revenue', false)
        ->assertSee('Low Revenue', false)
        ->assertDontSee('No Metrics', false);

    $snapshot = app(SaPerformanceService::class)->portfolioSnapshot();
    expect($snapshot['rows'])->toHaveCount(2)
        ->and($snapshot['rows'][0]['property']->address_line1)->toBe('High Revenue');
});

it('includes sa metrics in Carina baseline context when populated', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SA Carina '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sa-carina.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Flywheel Court',
        'city' => 'Manchester',
        'postcode' => 'M1 2SA',
        'property_type' => 'flat',
        'strategy' => 'sa',
        'status' => 'managing',
        'created_by' => $user->id,
        'sa_metrics' => [
            'occupancy_rate_30d' => 68,
            'airbnb_quality_score' => 4.9,
            'reviews_last_30d' => 4,
            'revenue_ytd' => 2200000,
            'updated_at' => now()->toIso8601String(),
        ],
    ]);

    $carina = app(CarinaService::class);
    $reflection = new ReflectionClass($carina);
    $method = $reflection->getMethod('buildSystemPrompt');
    $method->setAccessible(true);
    $conv = new CarinaConversation([
        'context_type' => 'property',
        'context_id' => $property->id,
    ]);
    $prompt = $method->invoke($carina, $conv, $user);

    expect($prompt)->toContain('SA performance metrics')
        ->and($prompt)->toContain('flywheel_health');

    tenancy()->end();
});

it('marks flywheel health as stalling when reviews_last_30d is zero', function (): void {
    $service = app(SaPerformanceService::class);

    $health = $service->flywheelHealth([
        'occupancy_rate_30d' => 75,
        'airbnb_quality_score' => 4.9,
        'reviews_last_30d' => 0,
    ]);

    expect($health)->toBe(SaPerformanceService::FLYWHEEL_STALLING);
});
