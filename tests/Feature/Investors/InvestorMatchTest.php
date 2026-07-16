<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'crm')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'pipeline')->update(['enabled' => true, 'tenant_overrides' => null]);
});

it('shows investor match pages for a pipeline deal and an investor contact', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Match UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@inv-match.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stage = PipelineStage::query()
        ->where('pipeline_id', $pipeline->id)
        ->where('is_won', false)
        ->where('is_lost', false)
        ->orderBy('position')
        ->firstOrFail();

    $property = Property::query()->create([
        'address_line1' => '1 Test Street',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'country' => 'GB',
        'property_type' => 'flat',
        'strategy' => 'btl',
        'status' => 'lead',
        'purchase_price' => 250_000,
        'gross_yield' => 6.5,
        'created_by' => $user->id,
    ]);

    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'property_id' => $property->id,
        'title' => 'Test pipeline deal',
        'position' => 0,
        'created_by' => $user->id,
        'priority' => 'medium',
        'deal_value' => 250_000,
    ]);

    $investor = Contact::factory()->investor()->create([
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/investors/deals/'.$deal->id.'/investor-matches')
        ->assertOk()
        ->assertSee('Matching investors', false);

    $this->get('http://'.$host.'/investors/contacts/'.$investor->id.'/deal-matches')
        ->assertOk()
        ->assertSee('Matching deals for', false);
});
