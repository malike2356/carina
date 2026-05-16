<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Input Format Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@format.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->baseUrl = 'http://'.$host;
});

it('sa calculator accepts named nightly_rate and occupancy_pct form inputs', function () {
    $response = $this->postJson($this->baseUrl.'/deals/calculate/sa', [
        'nightly_rate' => 120,
        'occupancy_pct' => 70,
    ]);

    $response->assertOk()
        ->assertJsonPath('strategy', 'sa')
        ->assertJsonStructure(['outputs' => ['annual_revenue', 'monthly_revenue']]);

    expect((float) $response->json('outputs.annual_revenue'))->toBeGreaterThan(0.0);
});

it('sa calculator with optional purchase price returns yield context in outputs', function () {
    $response = $this->postJson($this->baseUrl.'/deals/calculate/sa', [
        'nightly_rate' => 150,
        'occupancy_pct' => 75,
        'purchase_price' => 250000,
    ]);

    $response->assertOk();
    expect((float) $response->json('outputs.annual_revenue'))->toBeGreaterThan(0.0);
});

it('bridging calculator converts percentage rate to decimal correctly', function () {
    // JS sends rate / 100, so 12% becomes 0.12 in the POST body.
    $response = $this->postJson($this->baseUrl.'/deals/calculate/bridging', [
        'loan_amount' => 200000,
        'annual_interest_rate' => 0.12,
        'term_months' => 12,
    ]);

    $response->assertOk();
    // 200000 * 0.12 = 24000 interest
    $this->assertEqualsWithDelta(24000.0, (float) $response->json('outputs.interest_cost'), 1.0);
});

it('mortgage calculator converts percentage rate to decimal correctly', function () {
    $response = $this->postJson($this->baseUrl.'/deals/calculate/mortgage', [
        'loan_amount' => 180000,
        'annual_interest_rate' => 0.055,
        'term_years' => 25,
        'interest_only' => false,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['outputs' => ['monthly_payment']]);

    $monthly = (float) $response->json('outputs.monthly_payment');
    expect($monthly)->toBeGreaterThan(0.0)->toBeLessThan(2000.0);
});

it('mortgage interest only calculates simple interest monthly at percentage rate', function () {
    $response = $this->postJson($this->baseUrl.'/deals/calculate/mortgage', [
        'loan_amount' => 180000,
        'annual_interest_rate' => 0.055,
        'term_years' => 25,
        'interest_only' => true,
    ]);

    $response->assertOk();
    // 180000 * 0.055 / 12 = 825
    $this->assertEqualsWithDelta(825.0, (float) $response->json('outputs.monthly_payment'), 1.0);
});

it('brr calculator accepts percentage rates for refinance and management', function () {
    // JS sends refinance_rate_annual / 100 and management_pct / 100 before POST.
    $response = $this->postJson($this->baseUrl.'/deals/calculate/brr', [
        'purchase_price' => 200000,
        'refurb_cost' => 25000,
        'post_refurb_value' => 280000,
        'monthly_rent' => 1200,
        'refinance_rate_annual' => 0.055,
        'management_pct' => 0.10,
        'maintenance_monthly' => 100,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['outputs' => ['refinance_gross', 'cash_left_in']]);

    expect((float) $response->json('outputs.refinance_gross'))->toBeGreaterThan(0.0);
});

it('hmo calculator accepts room count and per room rent inputs', function () {
    $response = $this->postJson($this->baseUrl.'/deals/calculate/hmo', [
        'purchase_price' => 320000,
        'rooms' => 5,
        'rent_per_room_monthly' => 650,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['outputs' => ['gross_annual_rent', 'net_yield_pct']]);

    // 5 * 650 * 12 = 39000 before void allowance; HMO calculator applies a default void deduction
    expect((float) $response->json('outputs.gross_annual_rent'))->toBeGreaterThan(30000.0)->toBeLessThan(39001.0);
});

it('r2r calculator accepts landlord rent and returns positive profit when margin exists', function () {
    $response = $this->postJson($this->baseUrl.'/deals/calculate/r2r', [
        'rent_from_subtenants_monthly' => 2200,
        'rent_to_landlord_monthly' => 1600,
    ]);

    $response->assertOk()
        ->assertJsonStructure(['outputs' => ['monthly_profit', 'annual_profit']]);

    expect((float) $response->json('outputs.monthly_profit'))->toBeGreaterThan(0.0);
});
