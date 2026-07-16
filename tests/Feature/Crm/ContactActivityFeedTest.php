<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\User;
use App\Services\Crm\ContactActivityFeedService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('returns pipeline deals in feed', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Feed CRM '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'feed-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $contact = Contact::factory()->create();
    $pipeline = Pipeline::query()->create(['name' => 'Feed pipe', 'type' => 'sourcing', 'created_by' => $user->id]);
    $stage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Lead',
        'position' => 1,
        'is_won' => false,
        'is_lost' => false,
    ]);
    PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'contact_id' => $contact->id,
        'title' => 'Feed deal',
        'created_by' => $user->id,
    ]);

    $feed = app(ContactActivityFeedService::class)->forContact($contact);

    expect(collect($feed)->contains(fn (array $row): bool => $row['type'] === 'pipeline_deal'))->toBeTrue();
    tenancy()->end();
});

it('returns feed in reverse chronological order', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Feed order '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'feed-order-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $contact = Contact::factory()->create();
    $pipeline = Pipeline::query()->create(['name' => 'Order pipe', 'type' => 'sourcing', 'created_by' => $user->id]);
    $stage = PipelineStage::query()->create([
        'pipeline_id' => $pipeline->id,
        'name' => 'Lead',
        'position' => 1,
        'is_won' => false,
        'is_lost' => false,
    ]);
    $older = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'contact_id' => $contact->id,
        'title' => 'Older',
        'created_by' => $user->id,
    ]);
    $older->forceFill(['updated_at' => now()->subDays(2)])->save();
    $newer = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'contact_id' => $contact->id,
        'title' => 'Newer',
        'created_by' => $user->id,
    ]);
    $newer->touch();

    $feed = app(ContactActivityFeedService::class)->forContact($contact);
    $titles = array_column($feed, 'title');

    expect($titles[0] ?? '')->toBe('Newer');
    tenancy()->end();
});
