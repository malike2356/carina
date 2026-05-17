<?php

declare(strict_types=1);

use App\Enums\Gdpr\DataSubjectRequestStatus;
use App\Enums\Gdpr\RetentionPolicyAction;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Gdpr\DataRetentionPolicy;
use App\Models\Tenant\Gdpr\DataSubjectRequest;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('queues and completes a GDPR data export', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'GDPR export '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@gdpr-export.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/gdpr/export')->assertStatus(202);

    $this->getJson('http://'.$host.'/api/gdpr/export')
        ->assertOk()
        ->assertJsonPath('request.status', DataSubjectRequestStatus::Completed->value)
        ->assertJsonStructure(['request' => ['download_url']]);

    tenancy()->initialize($tenant);
    $req = DataSubjectRequest::query()->forUser($user->id)->exports()->firstOrFail();
    expect($req->status)->toBe(DataSubjectRequestStatus::Completed);
    tenancy()->end();
});

it('records marketing consent and lists latest state', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'GDPR consent '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@gdpr-consent.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->postJson('http://'.$host.'/api/gdpr/consents/marketing', ['accepted' => true])->assertOk();

    $this->getJson('http://'.$host.'/api/gdpr/consents')
        ->assertOk()
        ->assertJsonPath('consents.marketing.accepted', true);

    $this->deleteJson('http://'.$host.'/api/gdpr/consents/marketing')->assertOk();

    $this->getJson('http://'.$host.'/api/gdpr/consents')
        ->assertOk()
        ->assertJsonPath('consents.marketing.accepted', false);
});

it('allows workspace admin to approve account deletion for another user', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'GDPR delete '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@gdpr-delete.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $owner = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $owner->forceFill(['password' => Hash::make('owner-secret')])->save();
    completeTenantWorkspaceOnboarding();
    $member = User::factory()->create([
        'email' => 'member-'.uniqid().'@gdpr-delete.test',
        'password' => Hash::make('member-secret'),
    ]);
    tenancy()->end();

    $this->actingAs($member, 'web');
    $created = $this->postJson('http://'.$host.'/api/gdpr/deletion')->assertCreated();
    $id = (int) $created->json('id');

    $this->actingAs($owner, 'web');
    $this->postJson('http://'.$host.'/admin/gdpr/requests/'.$id.'/approve')->assertOk();

    tenancy()->initialize($tenant);
    expect($member->fresh()->email)->toStartWith('deleted+');
    expect(DataSubjectRequest::query()->find($id)?->status)->toBe(DataSubjectRequestStatus::Completed);
    tenancy()->end();
});

it('anonymizes stale CRM contacts when a retention policy says so', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'GDPR retention '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@gdpr-retention.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $owner = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $contact = Contact::query()->create([
        'first_name' => 'Stale',
        'last_name' => 'Person',
        'email' => 'stale-'.uniqid().'@example.test',
        'type' => 'other',
        'created_by' => $owner->id,
        'created_at' => now()->subYear(),
        'updated_at' => now()->subYear(),
    ]);

    DataRetentionPolicy::query()->create([
        'model_type' => Contact::class,
        'retention_days' => 30,
        'action' => RetentionPolicyAction::Anonymize,
    ]);

    Artisan::call('gdpr:anonymize-expired');

    expect($contact->fresh()->first_name)->toBe('Redacted');
    tenancy()->end();
});

it('shows the member privacy settings page with export and deletion actions', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'GDPR privacy UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@gdpr-privacy-ui.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/settings/privacy')
        ->assertOk()
        ->assertSee('Download my data', false)
        ->assertSee('Delete my account', false)
        ->assertSee('Request data export', false);
});

it('shows admin guidance on the data subject requests queue', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'GDPR admin UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@gdpr-admin-ui.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $owner = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($owner, 'web')
        ->get('http://'.$host.'/admin/gdpr/requests')
        ->assertOk()
        ->assertSee('What this queue is for', false)
        ->assertSee('Privacy &amp; your data', false)
        ->assertSee('No requests yet', false);
});
