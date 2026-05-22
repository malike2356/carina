<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates reads updates and deletes a contact via the mobile CRM API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile CRM '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-crm.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-crm')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-crm',
        'device_uuid' => 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $create = $this->postJson('http://'.$host.'/api/v1/mobile/crm/contacts', [
        'first_name' => 'Jane',
        'last_name' => 'Investor',
        'email' => 'jane@example.com',
        'type' => 'investor',
    ], $headers);
    $create->assertCreated()
        ->assertJsonPath('data.first_name', 'Jane')
        ->assertJsonPath('data.type', 'investor');

    $contactId = (int) $create->json('data.id');

    $this->getJson('http://'.$host.'/api/v1/mobile/crm/contacts/'.$contactId, $headers)
        ->assertOk()
        ->assertJsonPath('data.last_name', 'Investor');

    $this->putJson('http://'.$host.'/api/v1/mobile/crm/contacts/'.$contactId, [
        'first_name' => 'Jane',
        'last_name' => 'Updated',
        'type' => 'investor',
    ], $headers)
        ->assertOk()
        ->assertJsonPath('data.last_name', 'Updated');

    $this->deleteJson('http://'.$host.'/api/v1/mobile/crm/contacts/'.$contactId, [], $headers)
        ->assertNoContent();
});

it('lists contacts with pagination', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile CRM List '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-crm-list.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-list')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-list',
        'device_uuid' => 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
    ])->assertOk()->json('access_token');

    $this->getJson('http://'.$host.'/api/v1/mobile/crm/contacts', ['Authorization' => 'Bearer '.$token])
        ->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
});

it('logs and retrieves interactions for a contact', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile CRM Interactions '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-crm-int.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-int')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-int',
        'device_uuid' => 'cccccccc-3333-3333-3333-cccccccccccc',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $contactId = (int) $this->postJson('http://'.$host.'/api/v1/mobile/crm/contacts', [
        'first_name' => 'Bob',
        'last_name' => 'Lead',
        'type' => 'investor',
    ], $headers)->assertCreated()->json('data.id');

    $this->postJson('http://'.$host.'/api/v1/mobile/crm/contacts/'.$contactId.'/interactions', [
        'type' => 'note',
        'subject' => 'Initial call',
        'description' => 'Discussed investment goals.',
    ], $headers)->assertCreated();

    $this->getJson('http://'.$host.'/api/v1/mobile/crm/contacts/'.$contactId.'/interactions', $headers)
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.subject', 'Initial call');
});
