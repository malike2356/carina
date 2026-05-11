<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('renders contact show with interaction logging UI', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'CRM Show UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@crm-show-ui.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $contact = Contact::query()->create([
        'first_name' => 'Sam',
        'last_name' => 'Case',
        'type' => 'buyer',
        'email' => 'sam-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    $contactId = $contact->id;
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/contacts/'.$contactId)
        ->assertOk()
        ->assertSee('Log activity', false)
        ->assertSee('Add interaction', false)
        ->assertSee('Timeline', false)
        ->assertSee('crmContactInteractions', false);
});

it('renders investor intelligence panel on investor contact show', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'CRM Investor UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@crm-investor-ui.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $contact = Contact::factory()->investor()->create([
        'created_by' => $user->id,
    ]);
    $contactId = $contact->id;
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/contacts/'.$contactId)
        ->assertOk()
        ->assertSee('Investor intelligence', false)
        ->assertSee('crmInvestorIntel', false)
        ->assertSee('Matched pipeline deals', false);
});
