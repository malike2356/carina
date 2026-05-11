<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAlert;
use App\Models\Tenant\SourcingCriterion;
use App\Models\Tenant\SourcingResearchLink;
use App\Models\Tenant\User;
use App\Notifications\Tenant\ResearchLinkSavedNotification;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('stores a research link and creates alignment inbox alert when hints match an active criterion', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Research Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@research.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    SourcingCriterion::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'created_by' => $user->id,
        'name' => 'Manchester patch',
        'strategy' => 'btl',
        'postcodes' => ['M1'],
        'is_active' => true,
    ]);
    tenancy()->end();

    Notification::fake();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/deals/sourcing/research-links', [
        'url' => 'https://www.propertydata.co.uk/research/example',
        'title' => 'PD local data',
        'postcode' => 'M1 1AA',
        'notify_on_save' => '1',
    ])->assertRedirect();

    tenancy()->initialize($tenant);

    expect(SourcingResearchLink::query()->where('created_by', $user->id)->count())->toBe(1)
        ->and(DealAlert::query()
            ->where('created_by', $user->id)
            ->where('criteria->source', 'research_alignment')
            ->exists())->toBeTrue();

    Notification::assertSentTo($user, ResearchLinkSavedNotification::class);

    tenancy()->end();
});

it('shows research links index for the tenant user', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Research Nav Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@researchnav.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/sourcing/research-links')
        ->assertOk()
        ->assertSee('Research links', false);
});
