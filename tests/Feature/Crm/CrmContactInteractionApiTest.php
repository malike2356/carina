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

it('stores lists updates and deletes interactions', function () {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'CRM Int '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@crm-int.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $contact = Contact::query()->create([
        'first_name' => 'Pat',
        'last_name' => 'Lee',
        'type' => 'agent',
        'email' => 'pat-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    $cid = $contact->id;
    tenancy()->end();

    $this->actingAs($user, 'web');

    $post = $this->postJson('http://'.$host.'/api/crm/contacts/'.$cid.'/interactions', [
        'type' => 'call',
        'subject' => 'Intro call',
        'description' => 'Discussed fees',
        'duration_minutes' => 15,
        'occurred_at' => now()->subHour()->toIso8601String(),
    ]);
    $post->assertCreated()->assertJsonPath('subject', 'Intro call');
    $iid = (int) $post->json('id');

    $this->getJson('http://'.$host.'/api/crm/contacts/'.$cid.'/interactions')
        ->assertOk()
        ->assertJsonCount(1, 'data');

    $this->putJson('http://'.$host.'/api/crm/interactions/'.$iid, [
        'subject' => 'Intro call (updated)',
        'type' => 'call',
        'occurred_at' => now()->subMinutes(30)->toIso8601String(),
    ])->assertOk()->assertJsonPath('subject', 'Intro call (updated)');

    $this->deleteJson('http://'.$host.'/api/crm/interactions/'.$iid)->assertOk();

    tenancy()->initialize($tenant);
    expect($contact->fresh()->interactions()->count())->toBe(0);
    tenancy()->end();
});
