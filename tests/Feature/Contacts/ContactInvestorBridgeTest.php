<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'crm')->update(['enabled' => true, 'tenant_overrides' => null]);
});

it('bridges CRM contact show and list with the investors hub for investor contacts', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Bridge '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@inv-bridge.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $investor = Contact::factory()->investor()->create([
        'created_by' => $user->id,
        'min_budget' => 100_000,
        'max_budget' => 250_000,
        'investor_pipeline_stage' => 'cold',
        'last_contacted_at' => null,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/contacts/'.$investor->id)
        ->assertOk()
        ->assertSee('Investor profile', false)
        ->assertSee('100,000', false);

    $this->get('http://'.$host.'/contacts')
        ->assertOk()
        ->assertSee('Investor', false);

    $this->get('http://'.$host.'/investors')
        ->assertOk()
        ->assertSee('CRM profile', false);
});
