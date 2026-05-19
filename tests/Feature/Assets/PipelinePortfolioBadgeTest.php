<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Asset;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    tenancy()->end();
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', BillingModule::AssetManager->value)->update(['enabled' => true]);
});

function pipelineBadgeTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Pipeline Badge '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pipeline-badge.test',
        'plan' => 'operator',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('shows in portfolio badge on pipeline deal documents page when property has asset record', function (): void {
    [$tenant, $host, $user] = pipelineBadgeTenant();

    tenancy()->initialize($tenant);
    $property = Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => '10 Badge Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'status' => 'owned',
        'strategy' => 'btl',
        'current_value' => 250000,
        'mortgage_balance' => 150000,
    ]);

    Asset::query()->create([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'name' => '10 Badge Lane',
        'category' => 'property_ref',
        'current_value' => 250000,
    ]);

    $pipeline = Pipeline::query()->create(['name' => 'Test', 'type' => 'sourcing', 'created_by' => $user->id]);
    $stage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Offer',
        'color' => '#000',
        'position' => 1,
    ]);
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'property_id' => $property->id,
        'title' => 'Badge deal',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/pipelines/'.$pipeline->id.'/deals/'.$deal->id.'/documents')
        ->assertOk()
        ->assertSee('In Portfolio')
        ->assertSee('100,000')
        ->assertSee('equity');
});
