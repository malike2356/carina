<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\AreaProfile;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\DealShortlist;
use App\Models\Tenant\Property;
use App\Models\Tenant\SourcingCriterion;
use App\Models\Tenant\User;
use App\Notifications\Tenant\SourcingMatchNotification;
use App\Services\Deals\AlertDispatchService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('shows shortlist and area profile links on the deal workspace', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Ws Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@shortlist-ws.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/deals/workspace')
        ->assertOk()
        ->assertSee('Deal shortlists', false)
        ->assertSee('Area profiles', false);
});

it('creates updates and deletes a deal shortlist with analyses', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Sl Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@shortlist.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Test row',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/deals/sourcing/shortlists', [
        'name' => 'Hot list',
        'notes' => 'Q1',
        'deal_analysis_ids' => [(string) $deal->id],
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $sl = DealShortlist::query()->where('created_by', $user->id)->firstOrFail();
    expect($sl->name)->toBe('Hot list')
        ->and($sl->dealAnalyses)->toHaveCount(1);
    tenancy()->end();

    $this->put('http://'.$host.'/deals/sourcing/shortlists/'.$sl->id, [
        'name' => 'Hot list v2',
        'notes' => '',
        'deal_analysis_ids' => [],
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $sl->refresh();
    expect($sl->name)->toBe('Hot list v2')
        ->and($sl->dealAnalyses)->toHaveCount(0);
    tenancy()->end();

    $this->delete('http://'.$host.'/deals/sourcing/shortlists/'.$sl->id)->assertRedirect();

    tenancy()->initialize($tenant);
    expect(DealShortlist::query()->whereKey($sl->id)->exists())->toBeFalse();
    tenancy()->end();
});

it('creates an area profile with criteria and map pin', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Ap Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@areaprofile.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $c = SourcingCriterion::query()->create([
        'tenant_id' => null,
        'created_by' => $user->id,
        'name' => 'B1 band',
        'strategy' => 'btl',
        'is_active' => true,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/deals/sourcing/profiles', [
        'name' => 'Birmingham north',
        'notes' => 'Focus',
        'sourcing_criterion_ids' => [(string) $c->id],
        'map_latitude' => '52.4862',
        'map_longitude' => '-1.8904',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $p = AreaProfile::query()->where('created_by', $user->id)->firstOrFail();
    expect($p->name)->toBe('Birmingham north')
        ->and($p->sourcing_criterion_ids)->toBe([$c->id])
        ->and((string) $p->map_latitude)->toContain('52.48');
    tenancy()->end();
});

it('returns 403 when editing another users area profile', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Ap2 Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@areaprofile2.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $owner = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $other = User::factory()->create();
    $profile = AreaProfile::query()->create([
        'created_by' => $other->id,
        'name' => 'Other profile',
        'sourcing_criterion_ids' => null,
    ]);
    tenancy()->end();

    $this->actingAs($owner, 'web');

    $this->get('http://'.$host.'/deals/sourcing/profiles/'.$profile->id.'/edit')
        ->assertForbidden();
});

it('sends one database notification per new sourcing match and dedupes repeats', function (): void {
    Notification::fake();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Nf Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@notify.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $criterion = SourcingCriterion::query()->create([
        'tenant_id' => null,
        'created_by' => $user->id,
        'name' => 'Match me',
        'strategy' => 'btl',
        'is_active' => true,
    ]);
    $property = Property::query()->create([
        'address_line1' => '1 Notify St',
        'city' => 'Birmingham',
        'postcode' => 'B1 1AA',
        'property_type' => 'terraced',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    $dispatch = app(AlertDispatchService::class);
    $dispatch->dispatchPropertyMatch($criterion, $property, 1.5);
    $dispatch->dispatchPropertyMatch($criterion, $property, 2.0);
    tenancy()->end();

    Notification::assertSentToTimes($user, SourcingMatchNotification::class, 1);
    Notification::assertSentTo($user, SourcingMatchNotification::class, function ($notification, array $channels): bool {
        return $notification instanceof SourcingMatchNotification
            && in_array('database', $channels, true)
            && in_array('mail', $channels, true)
            && $notification->inboxAbsoluteUrl !== null;
    });
});

it('adds a deal to a shortlist from the deal show page', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Attach Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@attach.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Attach target',
        'metrics' => [],
        'status' => 'draft',
    ]);
    $shortlist = DealShortlist::query()->create([
        'created_by' => $user->id,
        'name' => 'Watchlist',
        'notes' => null,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/deals/'.$deal->id.'/shortlists', [
        'deal_shortlist_id' => $shortlist->id,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect($shortlist->dealAnalyses()->where('deal_analyses.id', $deal->id)->exists())->toBeTrue();
    tenancy()->end();
});
