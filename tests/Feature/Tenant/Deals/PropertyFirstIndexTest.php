<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: User, 2: string}
 */
function bootstrapPropertyFirstTenant(string $label): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => $label.' '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@propertyfirst.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user, $host];
}

it('renders the property-first deals index with the url paste hero', function (): void {
    [, $user, $host] = bootstrapPropertyFirstTenant('PFI hero');

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals')
        ->assertOk()
        ->assertSee('Start from a listing URL', false)
        ->assertSee('Paste Rightmove, Zoopla, or OnTheMarket URL', false);
});

it('shows existing deals as cards in the grid', function (): void {
    [$tenant, $user, $host] = bootstrapPropertyFirstTenant('PFI cards');

    tenancy()->initialize($tenant);
    DealAnalysis::query()->create([
        'title' => 'Slide Over Test Deal',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => ['asking_price' => 220000],
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals')
        ->assertOk()
        ->assertSee('Slide Over Test Deal', false)
        ->assertSee('xl:grid-cols-3', false);
});

it('shows the empty state when no deals exist', function (): void {
    [, $user, $host] = bootstrapPropertyFirstTenant('PFI empty');

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals')
        ->assertOk()
        ->assertSee('No deals yet', false);
});

it('slide-over endpoint returns json with the four expected keys', function (): void {
    [$tenant, $user, $host] = bootstrapPropertyFirstTenant('PFI json');

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->create([
        'title' => 'JSON Endpoint Deal',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => ['asking_price' => 175000, 'calculator_last' => ['purchase_price' => 175000, 'monthly_cash_flow' => 250]],
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->getJson('http://'.$host.'/deals/'.$deal->id.'/slide-over')
        ->assertOk()
        ->assertJsonStructure(['title', 'subtitle', 'deal_url', 'tab', 'html'])
        ->assertJsonPath('title', 'JSON Endpoint Deal')
        ->assertJsonPath('tab', 'numbers');
});

it('slide-over numbers tab renders calculator figures', function (): void {
    [$tenant, $user, $host] = bootstrapPropertyFirstTenant('PFI numbers');

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->create([
        'title' => 'Numbers Tab Deal',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => [
            'calculator_last' => [
                'purchase_price' => 200000,
                'monthly_cash_flow' => 400,
                'gross_yield' => 6.5,
            ],
        ],
    ]);
    tenancy()->end();

    $response = $this->actingAs($user, 'web')
        ->getJson('http://'.$host.'/deals/'.$deal->id.'/slide-over?tab=numbers')
        ->assertOk();

    $html = $response->json('html');
    expect($html)
        ->toBeString()
        ->toContain('Purchase price')
        ->toContain('£200,000')
        ->toContain('Gross yield');
});

it('slide-over numbers tab shows the empty calculator CTA when nothing has been run', function (): void {
    [$tenant, $user, $host] = bootstrapPropertyFirstTenant('PFI numbers empty');

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->create([
        'title' => 'No Numbers Yet',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => [],
    ]);
    tenancy()->end();

    $response = $this->actingAs($user, 'web')
        ->getJson('http://'.$host.'/deals/'.$deal->id.'/slide-over?tab=numbers')
        ->assertOk();

    expect($response->json('html'))->toContain('No calculator run yet');
});

it('slide-over falls back to the numbers tab when an unknown tab is requested', function (): void {
    [$tenant, $user, $host] = bootstrapPropertyFirstTenant('PFI fallback');

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->create([
        'title' => 'Tab Fallback Deal',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => [],
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->getJson('http://'.$host.'/deals/'.$deal->id.'/slide-over?tab=bogus')
        ->assertOk()
        ->assertJsonPath('tab', 'numbers');
});

it('slide-over redirects unauthenticated requests to login', function (): void {
    [$tenant, , $host] = bootstrapPropertyFirstTenant('PFI auth');

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->create([
        'title' => 'Anon Test',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => User::query()->firstOrFail()->id,
        'metrics' => [],
    ]);
    tenancy()->end();

    $this->get('http://'.$host.'/deals/'.$deal->id.'/slide-over')
        ->assertRedirect();
});

it('prefers the property address for the slide-over subtitle when one is linked', function (): void {
    [$tenant, $user, $host] = bootstrapPropertyFirstTenant('PFI subtitle');

    tenancy()->initialize($tenant);
    $property = Property::query()->create([
        'address_line1' => '99 Slide Over Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'flat',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);
    $deal = DealAnalysis::query()->create([
        'property_id' => $property->id,
        'title' => 'Address Subtitle Deal',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => [],
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->getJson('http://'.$host.'/deals/'.$deal->id.'/slide-over')
        ->assertOk()
        ->assertJsonPath('subtitle', '99 Slide Over Lane');
});
