<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'community_learning')->update(['enabled' => true]);

    communityHubWorkspace();
});

function communityHubTenantHost(Tenant $tenant): string
{
    return $tenant->domains->first()->domain.'.propreneur.test';
}

/**
 * @return array{tenant: Tenant, host: string}
 */
function communityHubWorkspace(): array
{
    static $tenant = null;
    static $host = null;

    if ($tenant === null) {
        $tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Hub UI Shared '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-hub-ui-'.uniqid().'@shared.test',
            'plan' => 'starter',
        ]);
        $tenant->load('domains');
        $host = communityHubTenantHost($tenant);
    }

    return ['tenant' => $tenant, 'host' => $host];
}

it('renders the community hub page with alpine config for authenticated tenant users', function (): void {
    ['tenant' => $tenant, 'host' => $host] = communityHubWorkspace();

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web');

    $response = $this->get("http://{$host}/community");

    $response->assertOk();
    $response->assertSee('Discussions', false);
    $response->assertSee('communityHub', false);
    $response->assertSee('currentUserId', false);
    $response->assertSee('carinaPostUrlTemplate', false);
    $response->assertSee('View thread', false);
});
