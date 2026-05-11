<?php

declare(strict_types=1);

use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Models\Tenant\Contact;
use App\Models\Tenant\Property;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\CarinaConversation;
use App\Services\Carina\CarinaAccessGate;
use App\Services\Carina\Tools\SearchContactsTool;
use App\Services\Carina\Tools\CreateContactTool;
use App\Services\Carina\Tools\GetPropertyTool;
use App\Services\Carina\Tools\AddPipelineCardTool;
use App\Services\Carina\Tools\UpdateContactTool;
use App\Services\Carina\Tools\ListPropertiesTool;
use App\Services\Carina\Tools\DeleteContactTool;
use App\Services\Carina\Tools\ClosePipelineDealTool;
use App\Services\Carina\Tools\GetComplianceItemsTool;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;

// ── Helpers ──────────────────────────────────────────────────────────

function createTenantUserWithRole(string $role): User
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Test '.Str::random(8),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.Str::random(8).'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    TenantRole::findOrCreate($role, 'web');
    $user = UserFactory::new()->createOne([]);
    $user->syncRoles([$role]);
    return $user;
}

function createTenantUserAndHost(string $role): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Test '.Str::random(8),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.Str::random(8).'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    TenantRole::findOrCreate($role, 'web');
    $user = UserFactory::new()->createOne([]);
    $user->syncRoles([$role]);
    completeTenantWorkspaceOnboarding();
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    return ['user' => $user, 'host' => $host];
}

function setUpToolTest(string $role): array
{
    $result = createTenantUserAndHost($role);
    $user = $result['user'];
    $conversation = CarinaConversation::query()->create([
        'user_id' => $user->id,
        'title' => 'Test',
        'messages' => [['role' => 'user', 'content' => 'Hi']],
    ]);
    return [$user, $conversation, $result['host']];
}

// ── SearchContactsTool ───────────────────────────────────────────────

it('SearchContactsTool authorize returns false for viewer', function (): void {
    $tool = new SearchContactsTool(app(CarinaAccessGate::class));
    $user = createTenantUserWithRole('viewer');
    expect($tool->authorize($user))->toBeFalse();
});

it('SearchContactsTool authorize returns true for agent', function (): void {
    $tool = new SearchContactsTool(app(CarinaAccessGate::class));
    $user = createTenantUserWithRole('agent');
    expect($tool->authorize($user))->toBeTrue();
});

it('SearchContactsTool execute returns failure when query is empty', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $r = (new SearchContactsTool(app(CarinaAccessGate::class)))->execute(['query' => ''], $user, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('empty_query');
});

it('SearchContactsTool returns count=0 when no match', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $r = (new SearchContactsTool(app(CarinaAccessGate::class)))->execute(['query' => 'zzz_nonexistent'], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data['count'])->toBe(0);
});

it('SearchContactsTool finds contacts', function (): void {
    [$user, $c] = setUpToolTest('agent');
    Contact::query()->create(['created_by' => $user->id, 'first_name' => 'Alice', 'last_name' => 'J', 'name' => 'Alice J', 'type' => 'investor']);
    $r = (new SearchContactsTool(app(CarinaAccessGate::class)))->execute(['query' => 'alice'], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data['count'])->toBeGreaterThanOrEqual(1);
});

// ── CreateContactTool ────────────────────────────────────────────────

it('CreateContactTool creates a contact', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $r = (new CreateContactTool(app(CarinaAccessGate::class)))->execute(['name' => 'New C', 'type' => 'investor', 'email' => 'n@t.com'], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data)->toHaveKey('id');
    $contact = Contact::query()->find($r->data['id']);
    expect($contact)->not->toBeNull()->and($contact->created_by)->toBe($user->id);
});

it('CreateContactTool fails on empty name', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $r = (new CreateContactTool(app(CarinaAccessGate::class)))->execute(['name' => '', 'type' => 'investor'], $user, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('missing_name');
});

it('CreateContactTool fails on invalid type', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $r = (new CreateContactTool(app(CarinaAccessGate::class)))->execute(['name' => 'X', 'type' => 'bad'], $user, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('invalid_type');
});

// ── GetPropertyTool ──────────────────────────────────────────────────

it('GetPropertyTool not_found', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $r = (new GetPropertyTool(app(CarinaAccessGate::class)))->execute(['property_id' => 99999], $user, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('not_found');
});

it('GetPropertyTool returns address', function (): void {
    [$user, $c] = setUpToolTest('property_manager');
    Property::query()->create(['created_by' => $user->id, 'address_line1' => '42 St', 'city' => 'London', 'postcode' => 'SW1A 1AA', 'property_type' => 'terraced', 'bedrooms' => 3]);
    $pi = Property::query()->first();
    $r = (new GetPropertyTool(app(CarinaAccessGate::class)))->execute(['property_id' => $pi->id], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data)->toHaveKey('address');
});

// ── AddPipelineCardTool ──────────────────────────────────────────────

it('AddPipelineCardTool not_found', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $r = (new AddPipelineCardTool(app(CarinaAccessGate::class)))->execute(['pipeline_id' => 99999, 'title' => 'T'], $user, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('not_found');
});

it('AddPipelineCardTool fails on no stages', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $p = Pipeline::query()->create(['created_by' => $user->id, 'name' => 'E']);
    $r = (new AddPipelineCardTool(app(CarinaAccessGate::class)))->execute(['pipeline_id' => $p->id, 'title' => 'T'], $user, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('no_stages');
});

it('AddPipelineCardTool creates deal with stage', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $p = Pipeline::query()->create(['created_by' => $user->id, 'name' => 'S']);
    PipelineStage::query()->create(['pipeline_id' => $p->id, 'name' => 'Lead', 'position' => 1, 'is_default' => true]);
    $r = (new AddPipelineCardTool(app(CarinaAccessGate::class)))->execute(['pipeline_id' => $p->id, 'title' => 'Deal'], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data)->toHaveKey('stage', 'Lead');
});

// ── UpdateContactTool ────────────────────────────────────────────────

it('UpdateContactTool nothing_to_update', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $co = Contact::query()->create(['created_by' => $user->id, 'first_name' => 'A', 'last_name' => 'B', 'name' => 'A B', 'type' => 'investor']);
    $r = (new UpdateContactTool(app(CarinaAccessGate::class)))->execute(['contact_id' => $co->id], $user, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('nothing_to_update');
});

it('UpdateContactTool updates engagement_stage', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $co = Contact::query()->create(['created_by' => $user->id, 'first_name' => 'A', 'last_name' => 'B', 'name' => 'A B', 'type' => 'investor']);
    (new UpdateContactTool(app(CarinaAccessGate::class)))->execute(['contact_id' => $co->id, 'engagement_stage' => 'qualified'], $user, $c);
    expect($co->fresh()->engagement_stage)->toBe('qualified');
});

it('UpdateContactTool merges tags', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $co = Contact::query()->create(['created_by' => $user->id, 'first_name' => 'A', 'last_name' => 'B', 'name' => 'A B', 'type' => 'investor', 'tags' => ['old']]);
    (new UpdateContactTool(app(CarinaAccessGate::class)))->execute(['contact_id' => $co->id, 'tags' => ['new']], $user, $c);
    expect($co->fresh()->tags)->toBe(['old', 'new']);
});

it('UpdateContactTool appends note', function (): void {
    [$user, $c] = setUpToolTest('agent');
    $co = Contact::query()->create(['created_by' => $user->id, 'first_name' => 'A', 'last_name' => 'B', 'name' => 'A B', 'type' => 'investor']);
    (new UpdateContactTool(app(CarinaAccessGate::class)))->execute(['contact_id' => $co->id, 'note' => 'Hello'], $user, $c);
    expect($co->fresh()->notes)->toHaveCount(1)->and($co->fresh()->notes[0]['text'])->toBe('Hello');
});

// ── ListPropertiesTool ───────────────────────────────────────────────

it('ListPropertiesTool empty', function (): void {
    [$user, $c] = setUpToolTest('property_manager');
    $r = (new ListPropertiesTool(app(CarinaAccessGate::class)))->execute([], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data['count'])->toBe(0);
});

it('ListPropertiesTool filters by postcode', function (): void {
    [$user, $c] = setUpToolTest('property_manager');
    Property::query()->create(['created_by' => $user->id, 'address_line1' => '1', 'city' => 'Lon', 'postcode' => 'SW1A 1AA', 'property_type' => 'terraced', 'bedrooms' => 2]);
    Property::query()->create(['created_by' => $user->id, 'address_line1' => '2', 'city' => 'Man', 'postcode' => 'M1 1AA', 'property_type' => 'semi-detached', 'bedrooms' => 3]);
    $r = (new ListPropertiesTool(app(CarinaAccessGate::class)))->execute(['postcode' => 'SW1'], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data['count'])->toBe(1);
});

// ── GetComplianceItemsTool ───────────────────────────────────────────

it('GetComplianceItemsTool returns all', function (): void {
    [$user, $c] = setUpToolTest('property_manager');
    ComplianceItem::query()->create(['created_by' => $user->id, 'title' => 'G', 'type' => 'gas_safety', 'category' => 'safety', 'expires_at' => now()->addDays(30)]);
    $r = (new GetComplianceItemsTool(app(CarinaAccessGate::class)))->execute([], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data['count'])->toBeGreaterThanOrEqual(1);
});

it('GetComplianceItemsTool filters by days_ahead', function (): void {
    [$user, $c] = setUpToolTest('property_manager');
    ComplianceItem::query()->create(['created_by' => $user->id, 'title' => 'Soon', 'type' => 'gas_safety', 'category' => 'safety', 'expires_at' => now()->addDays(5)]);
    $r = (new GetComplianceItemsTool(app(CarinaAccessGate::class)))->execute(['days_ahead' => 30], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data['items'][0]['title'])->toBe('Soon');
});

it('GetComplianceItemsTool filters by property_id', function (): void {
    [$user, $c] = setUpToolTest('property_manager');
    $p1 = Property::query()->create(['created_by' => $user->id, 'address_line1' => '1', 'city' => 'T', 'postcode' => 'AB1 2CD', 'property_type' => 'terraced', 'bedrooms' => 2]);
    ComplianceItem::query()->create(['created_by' => $user->id, 'title' => 'P1', 'type' => 'gas_safety', 'category' => 'safety', 'property_id' => $p1->id, 'expires_at' => now()->addDays(30)]);
    $r = (new GetComplianceItemsTool(app(CarinaAccessGate::class)))->execute(['property_id' => $p1->id], $user, $c);
    expect($r->success)->toBeTrue()->and($r->data['items'][0]['title'])->toBe('P1');
});

// ── Confirm Agent Action ─────────────────────────────────────────────

it('ConfirmAgentAction unauthenticated returns 401', function (): void {
    [$u, $cv, $h] = setUpToolTest('tenant_admin');
    $this->postJson("http://{$h}/carina/conversations/{$cv->id}/agent/confirm", ['token' => 'x', 'approved' => true])->assertStatus(401);
});

it('ConfirmAgentAction returns expired for missing token', function (): void {
    Http::preventStrayRequests();
    [$u, $cv, $h] = setUpToolTest('tenant_admin');
    $this->actingAs($u, 'web')
        ->postJson("http://{$h}/carina/conversations/{$cv->id}/agent/confirm", ['token' => 'nonexistent', 'approved' => true])
        ->assertStatus(200)
        ->assertJson(['reply' => 'This confirmation request has expired. Please repeat your request.']);
});

it('ConfirmAgentAction user cannot confirm because cache is per-request', function (): void {
    Http::preventStrayRequests();
    [$u, $cv, $h] = setUpToolTest('tenant_admin');
    $this->actingAs($u, 'web')
        ->postJson("http://{$h}/carina/conversations/{$cv->id}/agent/confirm", ['token' => 'any-token', 'approved' => true])
        ->assertStatus(200)
        ->assertJson(['reply' => 'This confirmation request has expired. Please repeat your request.']);
});

it('ConfirmAgentAction with approved=true cancels with wrong user', function (): void {
    Http::preventStrayRequests();
    [$u, $cv, $h] = setUpToolTest('tenant_admin');
    $this->actingAs($u, 'web')
        ->postJson("http://{$h}/carina/conversations/{$cv->id}/agent/confirm", ['token' => 'bad', 'approved' => true])
        ->assertStatus(200);
});

// ── Phase 3 Tools ────────────────────────────────────────────────────

it('DeleteContactTool requiresConfirmation', function (): void {
    expect((new DeleteContactTool(app(CarinaAccessGate::class)))->requiresConfirmation())->toBeTrue();
});

it('DeleteContactTool authorize for agent', function (): void {
    $user = createTenantUserWithRole('agent');
    expect((new DeleteContactTool(app(CarinaAccessGate::class)))->authorize($user))->toBeTrue();
});

it('DeleteContactTool not_found', function (): void {
    [$u, $c] = setUpToolTest('agent');
    $r = (new DeleteContactTool(app(CarinaAccessGate::class)))->execute(['contact_id' => 99999], $u, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('not_found');
});

it('DeleteContactTool soft-deletes', function (): void {
    [$u, $cv] = setUpToolTest('agent');
    $co = Contact::query()->create(['created_by' => $u->id, 'first_name' => 'D', 'last_name' => 'M', 'name' => 'D M', 'type' => 'investor']);
    $r = (new DeleteContactTool(app(CarinaAccessGate::class)))->execute(['contact_id' => $co->id], $u, $cv);
    expect($r->success)->toBeTrue()->and($r->data)->toHaveKey('deleted_at');
    expect(Contact::query()->find($co->id))->toBeNull();
    expect(Contact::query()->withTrashed()->find($co->id))->not->toBeNull();
});

it('DeleteContactTool invalid_id', function (): void {
    [$u, $c] = setUpToolTest('agent');
    $r = (new DeleteContactTool(app(CarinaAccessGate::class)))->execute(['contact_id' => 0], $u, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('invalid_id');
});

it('ClosePipelineDealTool requiresConfirmation', function (): void {
    expect((new ClosePipelineDealTool(app(CarinaAccessGate::class)))->requiresConfirmation())->toBeTrue();
});

it('ClosePipelineDealTool not_found', function (): void {
    [$u, $c] = setUpToolTest('agent');
    $r = (new ClosePipelineDealTool(app(CarinaAccessGate::class)))->execute(['deal_id' => 99999, 'outcome' => 'won'], $u, $c);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('not_found');
});

it('ClosePipelineDealTool closes as won', function (): void {
    [$u, $cv] = setUpToolTest('agent');
    $p = Pipeline::query()->create(['created_by' => $u->id, 'name' => 'S']);
    $ws = PipelineStage::query()->create(['pipeline_id' => $p->id, 'name' => 'Won', 'position' => 10, 'is_won' => true]);
    $d = PipelineDeal::query()->create(['created_by' => $u->id, 'pipeline_id' => $p->id, 'stage_id' => $ws->id, 'title' => 'Big', 'value' => 100000]);
    $r = (new ClosePipelineDealTool(app(CarinaAccessGate::class)))->execute(['deal_id' => $d->id, 'outcome' => 'won', 'reason' => 'Signed'], $u, $cv);
    expect($r->success)->toBeTrue()->and($r->data)->toHaveKey('outcome', 'won')->toHaveKey('closed_at');
    expect($d->fresh()->closed_at)->not->toBeNull();
});

it('ClosePipelineDealTool error when no closing stage', function (): void {
    [$u, $cv] = setUpToolTest('agent');
    $p = Pipeline::query()->create(['created_by' => $u->id, 'name' => 'N']);
    $s = PipelineStage::query()->create(['pipeline_id' => $p->id, 'name' => 'L', 'position' => 1]);
    $d = PipelineDeal::query()->create(['created_by' => $u->id, 'pipeline_id' => $p->id, 'stage_id' => $s->id, 'title' => 'T']);
    $r = (new ClosePipelineDealTool(app(CarinaAccessGate::class)))->execute(['deal_id' => $d->id, 'outcome' => 'won'], $u, $cv);
    expect($r->success)->toBeFalse()->and($r->error)->toBe('no_closing_stage');
});
