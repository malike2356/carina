<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\RefurbCatalogueItem;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('lists refurb catalogue and applies lines to a deal with rollup in metrics', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Refurb Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurb.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $ids = RefurbCatalogueItem::query()->orderBy('id')->limit(2)->pluck('id')->all();
    expect($ids)->not->toBeEmpty();

    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'brr',
        'title' => 'Refurb test',
        'metrics' => ['renovation_cost' => 0],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->getJson('http://'.$host.'/api/deal-analyses/refurb-catalogue')
        ->assertOk()
        ->assertJsonStructure(['data']);

    $this->postJson('http://'.$host.'/api/deal-analyses/'.$deal->id.'/refurb-lines/apply-catalogue', [
        'item_ids' => $ids,
    ])->assertCreated();

    $linesRes = $this->getJson('http://'.$host.'/api/deal-analyses/'.$deal->id.'/refurb-lines');
    $linesRes->assertOk();
    expect((float) $linesRes->json('rollup_total'))->toBeGreaterThan(0.0);

    tenancy()->initialize($tenant);
    $deal->refresh();
    expect((float) data_get($deal->metrics, 'renovation_cost'))->toBeGreaterThan(0.0);
    tenancy()->end();
});

it('exports refurb lines as csv and imports new rows from csv', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Refurb CSV Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@refurbcsv.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'brr',
        'title' => 'CSV deal',
        'metrics' => ['renovation_cost' => 0],
        'status' => 'draft',
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $csv = "description,quantity,unit_cost,vat_mode,catalogue_code,sort_order\nImported row,1,250.5,exempt,,1\n";
    $file = UploadedFile::fake()->createWithContent('lines.csv', $csv);

    $this->post('http://'.$host.'/api/deal-analyses/'.$deal->id.'/refurb-lines/import', [
        'file' => $file,
    ])->assertOk()->assertJson(['imported' => 1]);

    $export = $this->get('http://'.$host.'/api/deal-analyses/'.$deal->id.'/refurb-lines/export');
    $export->assertOk();
    expect((string) $export->headers->get('content-type'))->toContain('text/csv');

    $list = $this->getJson('http://'.$host.'/api/deal-analyses/'.$deal->id.'/refurb-lines');
    $list->assertOk();
    expect(collect($list->json('data'))->pluck('description')->contains('Imported row'))->toBeTrue();
});
