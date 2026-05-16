<?php

declare(strict_types=1);

use App\Models\Tenant\AcquisitionDocument;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('uploads acquisition documents and promotes a won pipeline deal to the portfolio', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Journey PL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@journey-pl.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $wonStage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->where('is_won', true)->firstOrFail();
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $wonStage->id,
        'title' => 'Completed acquisition',
        'position' => 0,
        'created_by' => $user->id,
        'priority' => 'medium',
        'deal_value' => 250_000,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/pipelines/'.$pipeline->id.'/deals/'.$deal->id.'/documents', [
        'file' => UploadedFile::fake()->create('mortgage-offer.pdf', 50),
        'name' => 'Mortgage offer',
    ])->assertRedirect('http://'.$host.'/pipelines/'.$pipeline->id.'/deals/'.$deal->id.'/documents');

    tenancy()->initialize($tenant);
    expect(AcquisitionDocument::query()->count())->toBe(1);
    tenancy()->end();

    $this->post('http://'.$host.'/pipelines/'.$pipeline->id.'/deals/'.$deal->id.'/promote-to-portfolio')
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $deal->refresh();
    expect($deal->property_id)->not->toBeNull();
    expect(Property::query()->whereKey($deal->property_id)->exists())->toBeTrue();
    tenancy()->end();
});

it('blocks promoting a pipeline deal that is not in a won stage', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Journey PL2 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@journey-pl2.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $openStage = PipelineStage::query()
        ->where('pipeline_id', $pipeline->id)
        ->where('is_won', false)
        ->where('is_lost', false)
        ->orderBy('position')
        ->firstOrFail();
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $openStage->id,
        'title' => 'Still negotiating',
        'position' => 0,
        'created_by' => $user->id,
        'priority' => 'medium',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->from('http://'.$host.'/pipelines/'.$pipeline->id)
        ->post('http://'.$host.'/pipelines/'.$pipeline->id.'/deals/'.$deal->id.'/promote-to-portfolio')
        ->assertSessionHasErrors(['stage']);
});

it('defaults new deal strategy from workspace_primary_strategy tenant setting', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Journey Deals '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@journey-deals.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    TenantSetting::query()->updateOrCreate(
        ['key' => 'workspace_primary_strategy'],
        ['value' => 'hmo', 'group' => 'workspace'],
    );
    tenancy()->end();

    $this->actingAs($user, 'web');

    $html = $this->get('http://'.$host.'/deals/create')->assertOk()->getContent();
    expect($html)->toMatch('/<option\s+value="hmo"[^>]*\bselected\b/');
});
