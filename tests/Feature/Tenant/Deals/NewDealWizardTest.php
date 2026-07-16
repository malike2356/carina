<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\DealAnalysis;
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
 * Spin up an isolated tenant for each scenario so we get a clean DealAnalysis
 * table and a workspace user that can sign in.
 *
 * @return array{0: Tenant, 1: User, 2: string}
 */
function bootstrapWizardTenant(string $label): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => $label.' '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@wizard.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user, $host];
}

it('renders the new deal landing page with paste-URL hero and shortcuts', function (): void {
    [, $user, $host] = bootstrapWizardTenant('Wizard render');

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/sourcing/manual-search')
        ->assertOk()
        ->assertSee('Paste a listing URL to start', false)
        ->assertSee('Off-market / direct', false)
        ->assertSee('Existing portfolio property', false)
        ->assertSee('Sourcing setup', false);
});

it('quick-saves a draft deal with portal URL prefill', function (): void {
    [$tenant, $user, $host] = bootstrapWizardTenant('Wizard quick-save');

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/deals/quick-save', [
            'title' => 'Test wizard deal',
            'strategy' => 'btl',
            'source_type' => 'url',
            'portal_url' => 'https://www.rightmove.co.uk/properties/12345678',
            'address_line1' => '12 Oak Street, Leeds',
        ])
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->where('title', 'Test wizard deal')->first();
    expect($deal)->not->toBeNull();
    expect($deal->strategy)->toBe('btl');
    expect($deal->status)->toBe('draft');
    expect($deal->created_by)->toBe($user->id);
    expect(data_get($deal->metrics, 'listing_source_url'))->toBe('https://www.rightmove.co.uk/properties/12345678');
    expect(data_get($deal->metrics, 'address_line1'))->toBe('12 Oak Street, Leeds');
    expect(data_get($deal->metrics, 'source_type'))->toBe('url');
    tenancy()->end();
});

it('rejects quick-save with an invalid strategy', function (): void {
    [, $user, $host] = bootstrapWizardTenant('Wizard reject');

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/deals/quick-save', [
            'title' => 'Bad deal',
            'strategy' => 'magic-beans',
        ])
        ->assertSessionHasErrors('strategy');
});

it('rejects quick-save without a title', function (): void {
    [, $user, $host] = bootstrapWizardTenant('Wizard no-title');

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/deals/quick-save', [
            'strategy' => 'brr',
        ])
        ->assertSessionHasErrors('title');
});

it('prefills the deal create form from wizard query params', function (): void {
    [, $user, $host] = bootstrapWizardTenant('Wizard prefill');

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/create?strategy=hmo&title=Test+title&portal_url=https%3A%2F%2Fexample.com%2Flisting&address_line1=42+Test+Road&source_type=url')
        ->assertOk()
        ->assertSee('Prefilled from the New Deal page', false)
        ->assertSee('Test title', false)
        ->assertSee('42 Test Road', false)
        ->assertSee('https://example.com/listing', false);
});
