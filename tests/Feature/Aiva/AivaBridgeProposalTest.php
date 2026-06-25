<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\AivaBridgeProposal;
use App\Models\Tenant\CarinaRemoteApiKey;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Aiva\AivaBridgeProposalService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

function aivaBridgeWriteTenantHost(): string
{
    test()->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Aiva Bridge Writes '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@aiva-bridge-writes.test',
        'plan' => 'starter',
    ]);

    test()->tenant = $tenant;
    test()->host = $tenant->domains->first()->domain.'.propreneur.test';

    foreach (['aiva_external_bridge', 'aiva_bridge_writes', 'aiva_bridge_review_queue'] as $flagKey) {
        $flag = FeatureFlag::query()->where('key', $flagKey)->firstOrFail();
        $flag->setTenantOverride((string) $tenant->getTenantKey(), true);
    }

    tenancy()->initialize($tenant);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return test()->host;
}

it('creates deal proposal without mutating pipeline until approved', function (): void {
    $host = aivaBridgeWriteTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();
    [$plain] = CarinaRemoteApiKey::mint('writes test', $user->id);

    $beforeCount = PipelineDeal::query()->count();
    tenancy()->end();

    $response = test()->postJson('http://'.$host.'/api/aiva-bridge/proposals/deal', [
        'title' => 'Bridge sourced deal',
        'property_id' => null,
        'deal_value' => 250000,
        'source_worker_ref' => 'aiva-worker-1',
    ], [
        'Authorization' => 'Bearer '.$plain,
        'Idempotency-Key' => 'deal-proposal-'.uniqid(),
    ]);

    $response->assertCreated()
        ->assertJsonPath('status', 'pending_review');

    tenancy()->initialize(test()->tenant);
    expect(PipelineDeal::query()->count())->toBe($beforeCount);
    expect(AivaBridgeProposal::query()->where('status', 'pending')->count())->toBe(1);
    tenancy()->end();
});

it('approves deal proposal and creates pipeline deal', function (): void {
    $host = aivaBridgeWriteTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();
    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->orderBy('position')->firstOrFail();

    $service = app(AivaBridgeProposalService::class);
    $proposal = $service->createProposal(AivaBridgeProposal::TYPE_DEAL, [
        'title' => 'Approved bridge deal',
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
    ]);

    $approved = $service->approve($proposal, $user);

    expect($approved->status)->toBe('approved');
    expect($approved->applied_result['pipeline_deal_id'] ?? null)->not->toBeNull();
    expect(PipelineDeal::query()->where('title', 'Approved bridge deal')->exists())->toBeTrue();
    tenancy()->end();
});

it('rejects proposal without side effects', function (): void {
    $host = aivaBridgeWriteTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();
    $service = app(AivaBridgeProposalService::class);
    $proposal = $service->createProposal(AivaBridgeProposal::TYPE_DEAL, [
        'title' => 'Rejected bridge deal',
    ]);

    $before = PipelineDeal::query()->count();
    $rejected = $service->reject($proposal, $user, 'Not needed');

    expect($rejected->status)->toBe('rejected');
    expect(PipelineDeal::query()->count())->toBe($before);
    tenancy()->end();
});

it('returns same proposal on idempotent replay', function (): void {
    $host = aivaBridgeWriteTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();
    [$plain] = CarinaRemoteApiKey::mint('idempotency', $user->id);
    tenancy()->end();

    $key = 'idem-'.uniqid();
    $headers = [
        'Authorization' => 'Bearer '.$plain,
        'Idempotency-Key' => $key,
    ];

    $first = test()->postJson('http://'.$host.'/api/aiva-bridge/proposals/deal', [
        'title' => 'Idempotent deal',
    ], $headers);

    $second = test()->postJson('http://'.$host.'/api/aiva-bridge/proposals/deal', [
        'title' => 'Idempotent deal',
    ], $headers);

    $first->assertCreated();
    $second->assertOk();
    expect($second->json('proposal_id'))->toBe($first->json('proposal_id'));
});

it('approves financial log proposal from email-style payload', function (): void {
    $host = aivaBridgeWriteTenantHost();
    tenancy()->initialize(test()->tenant);

    $user = User::query()->firstOrFail();
    $property = Property::query()->create([
        'address_line1' => '99 Bridge Lane',
        'city' => 'Leeds',
        'postcode' => 'LS9 9ZZ',
        'status' => 'owned',
        'property_type' => 'flat',
        'created_by' => $user->id,
    ]);

    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Test Tenant',
        'start_date' => now()->subMonths(3)->toDateString(),
        'rent_amount' => 850,
        'tenancy_type' => 'ast',
        'rent_frequency' => 'monthly',
    ]);

    $service = app(AivaBridgeProposalService::class);
    $proposal = $service->createProposal(AivaBridgeProposal::TYPE_FINANCIAL_LOG, [
        'property_id' => $property->id,
        'tenancy_id' => $tenancy->id,
        'amount' => 850.00,
        'paid_date' => now()->toDateString(),
        'notes' => 'From email digest: rent received',
        'review_notes' => 'Low confidence address match; verify amount',
    ], 'aiva-worker-email');

    $approved = $service->approve($proposal, $user);

    expect($approved->applied_result['tenancy_rent_payment_id'] ?? null)->not->toBeNull();
    expect(TenancyRentPayment::query()->where('property_id', $property->id)->exists())->toBeTrue();
    tenancy()->end();
});

it('returns 404 when bridge writes flag is disabled', function (): void {
    $host = aivaBridgeWriteTenantHost();
    tenancy()->initialize(test()->tenant);

    $flag = FeatureFlag::query()->where('key', 'aiva_bridge_writes')->firstOrFail();
    $flag->setTenantOverride((string) test()->tenant->getTenantKey(), false);

    $user = User::query()->firstOrFail();
    [$plain] = CarinaRemoteApiKey::mint('writes off', $user->id);
    tenancy()->end();

    test()->postJson('http://'.$host.'/api/aiva-bridge/proposals/deal', [
        'title' => 'Should fail',
    ], [
        'Authorization' => 'Bearer '.$plain,
    ])->assertNotFound();
});
