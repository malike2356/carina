<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Investors\InvestorsWorkspaceService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'crm')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: string, 2: User}
 */
function funnelQuickStageTenantHost(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Funnel QA '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@funnel-qa.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('quick stage endpoint advances an investor to the next stage', function () {
    [$tenant, $host, $user] = funnelQuickStageTenantHost();

    tenancy()->initialize($tenant);
    $investor = Contact::factory()->investor()->create([
        'created_by' => $user->id,
        'investor_funnel_stage' => 'lead',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->patchJson('http://'.$host.'/investors/funnel/'.$investor->id.'/stage', [
            'stage' => 'qualified',
        ])
        ->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('stage', 'qualified');

    tenancy()->initialize($tenant);
    expect($investor->fresh()->investor_funnel_stage)->toBe('qualified');
    tenancy()->end();
});

it('quick stage rejects an invalid stage value', function () {
    [$tenant, $host, $user] = funnelQuickStageTenantHost();

    tenancy()->initialize($tenant);
    $investor = Contact::factory()->investor()->create(['created_by' => $user->id]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->patchJson('http://'.$host.'/investors/funnel/'.$investor->id.'/stage', [
            'stage' => 'pipeline_stage_not_funnel',
        ])
        ->assertStatus(422);
});

it('quick stage returns 422 for a non-investor contact', function () {
    [$tenant, $host, $user] = funnelQuickStageTenantHost();

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create([
        'created_by' => $user->id,
        'type' => 'buyer',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->patchJson('http://'.$host.'/investors/funnel/'.$contact->id.'/stage', [
            'stage' => 'qualified',
        ])
        ->assertStatus(422);
});

it('funnel index page loads with funnelSummary variable', function () {
    [$tenant, $host, $user] = funnelQuickStageTenantHost();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/investors/funnel')
        ->assertOk()
        ->assertViewHas('funnelSummary');
});

it('funnelSummary counts overdue investors correctly', function () {
    $service = app(InvestorsWorkspaceService::class);

    $investors = collect([
        new Contact([
            'investor_funnel_stage' => 'lead',
            'last_contacted_at' => now()->subDays(20),
        ]),
        new Contact([
            'investor_funnel_stage' => 'lead',
            'last_contacted_at' => now()->subDays(5),
        ]),
        new Contact([
            'investor_funnel_stage' => 'lead',
            'last_contacted_at' => null,
        ]),
    ]);

    $summary = $service->funnelSummary($investors);

    expect($summary['lead']['count'])->toBe(3)
        ->and($summary['lead']['overdue'])->toBe(2);
});
