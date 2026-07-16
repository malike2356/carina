<?php

declare(strict_types=1);

/**
 * Carina open routes and POST conversations for non-deal contexts (tenant HTTP).
 */
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('opens Carina for property and compliance via POST with seeded investor brain', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Carina Surfaces '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-surfaces.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '10 Test Lane',
        'city' => 'London',
        'postcode' => 'SW1A1AA',
        'property_type' => 'flat',
        'created_by' => $user->id,
        'status' => 'owned',
        'strategy' => 'btl',
    ]);

    $compliance = ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Annual gas safety',
        'status' => 'valid',
        'reminder_days' => 30,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/carina/conversations', [
        'context_type' => 'property',
        'context_id' => $property->id,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $convProp = CarinaConversation::query()->latest('id')->first();
    expect($convProp)->not->toBeNull()
        ->and($convProp->context_type)->toBe('property')
        ->and((int) $convProp->context_id)->toBe($property->id)
        ->and($convProp->metadata['brain_key'] ?? null)->toBe('investor');
    tenancy()->end();

    $this->post('http://'.$host.'/carina/conversations', [
        'context_type' => 'compliance',
        'context_id' => $compliance->id,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $convComp = CarinaConversation::query()->latest('id')->first();
    expect($convComp)->not->toBeNull()
        ->and($convComp->context_type)->toBe('compliance')
        ->and((int) $convComp->context_id)->toBe($compliance->id);
    tenancy()->end();
});
