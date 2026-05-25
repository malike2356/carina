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
 * Spin up an isolated tenant so each scenario gets a clean DealAnalysis table
 * and a workspace user that can sign in.
 *
 * @return array{0: Tenant, 1: User, 2: string}
 */
function bootstrapNavTenant(string $label): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => $label.' '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@nav.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user, $host];
}

it('renders the active deals page with kanban and list tabs', function (): void {
    [, $user, $host] = bootstrapNavTenant('Nav kanban');

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/board')
        ->assertOk()
        ->assertSee('Active Deals', false)
        ->assertSee('Kanban', false)
        ->assertSee('All analyses', false);
});

it('shows draft deal title inside the kanban column', function (): void {
    [$tenant, $user, $host] = bootstrapNavTenant('Nav kanban deal');

    tenancy()->initialize($tenant);
    DealAnalysis::query()->create([
        'title' => 'Kanban Deal Test',
        'status' => 'draft',
        'strategy' => 'btl',
        'created_by' => $user->id,
        'metrics' => ['asking_price' => 150000],
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/board')
        ->assertOk()
        ->assertSee('Kanban Deal Test', false);
});

it('groups deals into the three active status columns and surfaces an archived chip', function (): void {
    [$tenant, $user, $host] = bootstrapNavTenant('Nav column buckets');

    tenancy()->initialize($tenant);
    DealAnalysis::query()->create(['title' => 'In Draft Pile',  'status' => 'draft',     'strategy' => 'btl', 'created_by' => $user->id, 'metrics' => []]);
    DealAnalysis::query()->create(['title' => 'In Shared Pile', 'status' => 'shared',    'strategy' => 'hmo', 'created_by' => $user->id, 'metrics' => []]);
    DealAnalysis::query()->create(['title' => 'Suggested Pile', 'status' => 'suggested', 'strategy' => 'brr', 'created_by' => $user->id, 'metrics' => []]);
    DealAnalysis::query()->create(['title' => 'Hidden Archive', 'status' => 'archived',  'strategy' => 'flip', 'created_by' => $user->id, 'metrics' => []]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/board')
        ->assertOk()
        ->assertSee('In Draft Pile', false)
        ->assertSee('In Shared Pile', false)
        ->assertSee('Suggested Pile', false)
        // The archived chip announces archived count in the tab bar; the
        // deal itself only appears in the list view (rendered in the DOM but
        // visually hidden until the "All analyses" tab is selected).
        ->assertSee('1 archived', false);
});

it('shows the all-analyses list view with archived deals included', function (): void {
    [$tenant, $user, $host] = bootstrapNavTenant('Nav list view');

    tenancy()->initialize($tenant);
    DealAnalysis::query()->create(['title' => 'Active Live Deal',  'status' => 'draft',    'strategy' => 'btl',  'created_by' => $user->id, 'metrics' => []]);
    DealAnalysis::query()->create(['title' => 'Archived Old Deal', 'status' => 'archived', 'strategy' => 'flip', 'created_by' => $user->id, 'metrics' => []]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/board')
        ->assertOk()
        ->assertSee('Active Live Deal', false)
        // The list-view section is in the DOM even when the kanban tab is
        // active (Alpine just hides it with x-show), so archived items show
        // up in the HTML payload.
        ->assertSee('Archived Old Deal', false);
});

it('renders the new deal page with a paste-url hero', function (): void {
    [, $user, $host] = bootstrapNavTenant('Nav new deal');

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/sourcing/manual-search')
        ->assertOk()
        ->assertSee('Paste a listing URL to start', false)
        ->assertSee('Sourcing setup', false);
});

it('shows the empty state hero when no deals exist', function (): void {
    [, $user, $host] = bootstrapNavTenant('Nav empty');

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/board')
        ->assertOk()
        ->assertSee('No deals yet', false)
        ->assertSee('Open calculators', false);
});
