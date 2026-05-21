<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Crm\ContactNetworkService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\ContactRelationshipTypes;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('adds and retrieves a relationship', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Net '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'net-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $from = Contact::factory()->create(['created_by' => $user->id, 'type' => 'investor']);
    $to = Contact::factory()->create(['created_by' => $user->id, 'type' => 'other']);

    $service = app(ContactNetworkService::class);
    $rel = $service->addRelationship($from, $to, ContactRelationshipTypes::INVESTOR_FOR);

    expect($rel->from_contact_id)->toBe($from->id)
        ->and($rel->to_contact_id)->toBe($to->id)
        ->and($rel->relationship_type)->toBe(ContactRelationshipTypes::INVESTOR_FOR);

    $from->refresh();
    expect($from->outboundRelationships)->toHaveCount(1);

    tenancy()->end();
});

it('ends a relationship', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Net End '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'net-end-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $from = Contact::factory()->create(['created_by' => $user->id]);
    $to = Contact::factory()->create(['created_by' => $user->id]);

    $service = app(ContactNetworkService::class);
    $rel = $service->addRelationship($from, $to, ContactRelationshipTypes::ASSOCIATE);
    $service->endRelationship($rel, '2025-01-15');

    $rel->refresh();
    expect($rel->ended_at?->format('Y-m-d'))->toBe('2025-01-15')
        ->and($rel->isActive())->toBeFalse();

    tenancy()->end();
});

it('traverses two hops', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Net Hop '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'net-hop-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $a = Contact::factory()->create(['created_by' => $user->id]);
    $b = Contact::factory()->create(['created_by' => $user->id]);
    $c = Contact::factory()->create(['created_by' => $user->id]);

    $service = app(ContactNetworkService::class);
    $service->addRelationship($a, $b, ContactRelationshipTypes::INVESTOR_FOR);
    $service->addRelationship($b, $c, ContactRelationshipTypes::SOURCER_FOR);

    $neighbours = $service->neighbourhood($a, 2);

    expect($neighbours)->toHaveKeys([$b->id, $c->id])
        ->and($neighbours[$c->id]['hops'])->toBe(2);

    tenancy()->end();
});

it('does not loop on circular relationships', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Net Loop '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'net-loop-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();

    $a = Contact::factory()->create(['created_by' => $user->id]);
    $b = Contact::factory()->create(['created_by' => $user->id]);

    $service = app(ContactNetworkService::class);
    $service->addRelationship($a, $b, ContactRelationshipTypes::ASSOCIATE);
    $service->addRelationship($b, $a, ContactRelationshipTypes::ASSOCIATE);

    $neighbours = $service->neighbourhood($a, 2);

    expect($neighbours)->toHaveCount(1)
        ->and($neighbours)->toHaveKey($b->id);

    tenancy()->end();
});
