<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('supports people directory JSON API including validation', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'CRM API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@crm-api.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/crm/contacts', [
        'first_name' => 'X',
        'last_name' => 'Y',
        'type' => 'not_a_real_type',
    ])->assertStatus(422);

    $list = $this->getJson('http://'.$host.'/api/crm/contacts');
    $list->assertOk()->assertJsonStructure(['data', 'meta']);

    $create = $this->postJson('http://'.$host.'/api/crm/contacts', [
        'first_name' => 'Sam',
        'last_name' => 'Smith',
        'type' => 'seller',
        'email' => 'sam-'.uniqid().'@example.test',
        'notes' => 'API note',
    ]);
    $create->assertCreated()
        ->assertJsonPath('first_name', 'Sam');

    $id = (int) $create->json('id');

    $this->getJson('http://'.$host.'/api/crm/contacts/'.$id)->assertOk()
        ->assertJsonPath('last_name', 'Smith');

    $dup = $this->postJson('http://'.$host.'/api/crm/contacts/'.$id.'/duplicate');
    $dup->assertCreated();
    expect((string) $dup->json('first_name'))->toContain('copy');

    $this->deleteJson('http://'.$host.'/api/crm/contacts/'.$dup->json('id'))->assertOk();

    tenancy()->initialize($tenant);
    expect(Contact::query()->findOrFail($id)->notes)->toBe(['text' => 'API note']);
    tenancy()->end();
});
