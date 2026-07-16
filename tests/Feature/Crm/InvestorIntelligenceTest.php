<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\ContactInteraction;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Deals\SourcingMatchService;
use App\Services\Scoring\ContactScoringService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('scores investor engagement and capacity and exposes investor score json', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Investor Intel '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@investor-intel.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $investor = Contact::factory()->investor()->create([
        'created_by' => $user->id,
        'total_invested' => 300_000,
    ]);

    ContactInteraction::query()->create([
        'contact_id' => $investor->id,
        'type' => 'email',
        'subject' => 'Hello',
        'description' => 'Body',
        'occurred_at' => now()->subDays(2),
        'created_by' => $user->id,
    ]);

    $scorer = app(ContactScoringService::class);
    $engagement = $scorer->calculateEngagementScore($investor);
    expect($engagement)->toBeGreaterThan(0);

    $total = $scorer->calculateTotalScore($investor->fresh());
    expect($total)->toBeGreaterThan(0)
        ->and($investor->fresh()->investment_score_total)->toBe($total);

    tenancy()->end();

    test()->actingAs($user, 'web');
    $res = test()->getJson('http://'.$host.'/api/crm/contacts/'.$investor->id.'/investor-score');
    $res->assertOk()
        ->assertJsonPath('total_score', $total)
        ->assertJsonStructure([
            'engagement_score',
            'capacity_score',
            'match_score',
            'engagement_stage',
        ]);
});

it('matches pipeline deal to investor using sourcing match service and api', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Investor Match '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@investor-match.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Match Street',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'flat',
        'strategy' => 'btl',
        'gross_yield' => 6.5,
        'purchase_price' => 340_000,
        'created_by' => $user->id,
    ]);

    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'property_id' => $property->id,
        'title' => 'BTL Manchester',
        'deal_value' => 350_000,
        'position' => 0,
        'created_by' => $user->id,
        'priority' => 'medium',
    ]);

    $investor = Contact::factory()->investor()->create([
        'created_by' => $user->id,
        'investment_criteria' => ['locations' => ['M1']],
    ]);

    $matcher = app(SourcingMatchService::class);
    $score = $matcher->calculateInvestorPipelineDealScore($investor, $deal);
    expect($score)->toBeGreaterThanOrEqual(8);

    tenancy()->end();

    test()->actingAs($user, 'web');
    test()->getJson('http://'.$host.'/api/crm/pipeline-deals/'.$deal->id.'/matched-investors?limit=5')
        ->assertOk()
        ->assertJsonStructure(['data']);

    $matched = test()->getJson('http://'.$host.'/api/crm/contacts/'.$investor->id.'/matched-pipeline-deals?limit=5');
    $matched->assertOk()
        ->assertJsonStructure(['data'])
        ->assertJsonPath('data.0.pipeline_deal_id', $deal->id)
        ->assertJsonPath('data.0.pipeline_id', $pipeline->id)
        ->assertJsonPath('data.0.title', 'BTL Manchester');
});
