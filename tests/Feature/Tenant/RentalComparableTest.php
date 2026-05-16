<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelinePreset;
use App\Models\Tenant\RentalComparable;
use App\Models\Tenant\User;
use App\Services\Pipeline\PipelinePresetService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: string, 2: User, 3: int, 4: int}
 */
function comparablesBoot(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Comparables '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@comp.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', BillingModule::Pipeline->value)->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    app(PipelinePresetService::class)->ensureSystemPresets();
    $preset = PipelinePreset::query()->where('slug', 'investors')->firstOrFail();
    app(PipelinePresetService::class)->createPipelineFromPreset($preset, null);
    $user = User::query()->firstOrFail();
    $pipeline = Pipeline::query()->firstOrFail();
    $stage = $pipeline->stages()->orderBy('position')->firstOrFail();
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Comp card',
        'position' => 0,
        'created_by' => $user->id,
    ]);
    $pId = $pipeline->id;
    $dId = $deal->id;
    tenancy()->end();

    return [$tenant, $host, $user, $pId, $dId];
}

it('manages rental comparables and exposes rental average', function (): void {
    [$tenant, $host, $user, $pId, $dId] = comparablesBoot();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/pipelines/'.$pId.'/deals/'.$dId.'/rental-comparables', [
        'address_or_description' => '1 Test Street',
        'rent_pcm' => 1000,
        'source' => 'rightmove',
        'bedrooms' => 2,
    ])->assertCreated();

    $this->postJson('http://'.$host.'/pipelines/'.$pId.'/deals/'.$dId.'/rental-comparables', [
        'address_or_description' => '2 Sample Road',
        'rent_pcm' => 1200,
        'source' => 'zoopla',
    ])->assertCreated();

    $this->getJson('http://'.$host.'/pipelines/'.$pId.'/deals/'.$dId.'/rental-comparables')
        ->assertOk()
        ->assertJsonPath('rental_average', 1100.0);

    tenancy()->initialize($tenant);
    $pd = PipelineDeal::query()->findOrFail($dId);
    expect($pd->rental_average)->toBe(1100.0);
    $comp = RentalComparable::query()->orderBy('id')->firstOrFail();
    tenancy()->end();

    $this->putJson('http://'.$host.'/pipelines/'.$pId.'/deals/'.$dId.'/rental-comparables/'.$comp->id, [
        'address_or_description' => '1 Test Street (updated)',
        'rent_pcm' => 900,
        'source' => 'rightmove',
    ])->assertOk();

    $this->deleteJson('http://'.$host.'/pipelines/'.$pId.'/deals/'.$dId.'/rental-comparables/'.$comp->id)
        ->assertNoContent();

    tenancy()->initialize($tenant);
    expect(RentalComparable::query()->count())->toBe(1);
    tenancy()->end();
});
