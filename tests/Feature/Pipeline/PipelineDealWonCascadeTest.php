<?php

declare(strict_types=1);

use App\Events\Tenant\Pipeline\PipelineDealWon;
use App\Models\Tenant\CommunityWin;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates post acquisition compliance checklist on deal won', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Won compliance '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'won-c-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '10 Won Street',
        'city' => 'Leeds',
        'postcode' => 'LS10 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $pipeline = Pipeline::query()->create(['name' => 'P', 'type' => 'sourcing', 'created_by' => $user->id]);
    $stage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Won',
        'position' => 1,
        'is_won' => true,
        'is_lost' => false,
    ]);
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'property_id' => $property->id,
        'title' => 'Won deal',
        'created_by' => $user->id,
    ]);

    PipelineDealWon::dispatch($deal);

    expect(ComplianceItem::query()->where('property_id', $property->id)->where('type', 'gas_safety')->exists())->toBeTrue();
    tenancy()->end();
});

it('creates acquisition cost journal draft on deal won', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Won journal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'won-j-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    GlAccount::query()->delete();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    $property = Property::query()->create([
        'address_line1' => '11 Journal Way',
        'city' => 'Leeds',
        'postcode' => 'LS11 1BB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $analysis = DealAnalysis::query()->create([
        'property_id' => $property->id,
        'title' => 'BRRR',
        'strategy' => 'brr',
        'metrics' => ['purchase_price' => 150000],
        'created_by' => $user->id,
    ]);
    $pipeline = Pipeline::query()->create(['name' => 'Acq', 'type' => 'sourcing', 'created_by' => $user->id]);
    $stage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Completed',
        'position' => 1,
        'is_won' => true,
        'is_lost' => false,
    ]);
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'property_id' => $property->id,
        'deal_analysis_id' => $analysis->id,
        'title' => 'Acquisition',
        'created_by' => $user->id,
    ]);

    PipelineDealWon::dispatch($deal);

    expect(JournalEntry::query()->where('reference', 'ACQ-'.$deal->id)->exists())->toBeTrue();
    expect(GlAccount::query()->where('code', '1200')->exists())->toBeTrue();
    tenancy()->end();
});

it('creates draft community win on deal won', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Won win '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'won-w-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $pipeline = Pipeline::query()->create(['name' => 'Win pipe', 'type' => 'sourcing', 'created_by' => $user->id]);
    $stage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Won',
        'position' => 1,
        'is_won' => true,
        'is_lost' => false,
    ]);
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Celebration deal',
        'created_by' => $user->id,
    ]);

    PipelineDealWon::dispatch($deal);

    $win = CommunityWin::query()->where('pipeline_deal_id', $deal->id)->first();
    expect($win)->not->toBeNull();
    expect($win->status)->toBe('draft');
    tenancy()->end();
});
