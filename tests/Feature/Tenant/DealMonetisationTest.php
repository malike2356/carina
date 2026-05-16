<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\DealMonetisationRecord;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelinePreset;
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
function monetisationBoot(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Monetisation '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mon.test',
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
        'title' => 'Monetisation card',
        'position' => 0,
        'created_by' => $user->id,
    ]);
    $pId = $pipeline->id;
    $dId = $deal->id;
    tenancy()->end();

    return [$tenant, $host, $user, $pId, $dId];
}

it('creates updates and enforces one monetisation row per deal', function (): void {
    [$tenant, $host, $user, $pId, $dId] = monetisationBoot();
    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/pipelines/'.$pId.'/deals/'.$dId.'/monetisation', [
        'finder_fee' => 5000,
        'staging_service_offered' => true,
        'staging_type' => 'full',
        'staging_cost_to_investor' => 4000,
        'staging_cost_to_sourcer' => 1000,
        'tenant_find_fee' => 200,
    ])->assertOk();

    tenancy()->initialize($tenant);
    expect(DealMonetisationRecord::query()->count())->toBe(1);
    $row = DealMonetisationRecord::query()->firstOrFail();
    expect($row->stagingProfit())->toBe(3000.0);
    expect($row->totalRevenueDeal())->toBe(8200.0);
    tenancy()->end();

    $this->postJson('http://'.$host.'/pipelines/'.$pId.'/deals/'.$dId.'/monetisation', [
        'finder_fee' => 6000,
        'staging_service_offered' => true,
        'staging_type' => 'full',
        'staging_cost_to_investor' => 4000,
        'staging_cost_to_sourcer' => 1000,
        'tenant_find_fee' => 200,
    ])->assertOk();

    tenancy()->initialize($tenant);
    expect(DealMonetisationRecord::query()->count())->toBe(1);
    expect((float) DealMonetisationRecord::query()->value('finder_fee'))->toBe(6000.0);
    tenancy()->end();
});
