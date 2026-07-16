<?php

declare(strict_types=1);

use App\Models\Tenant\CommunicationEnrollment;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Contact;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\Property;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Models\Tenant\WorkspaceAutomationRun;
use App\Services\Carina\CarinaService;
use App\Services\Pipeline\PipelineService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function (): void {
    Mail::fake();

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('complete')->andReturn("1. Register title.\n2. Notify utilities.");
    });
});

it('runs builtin workspace automation when a pipeline deal reaches won', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Automation Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@automation.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stages = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->get();
    $won = $stages->firstWhere('is_won', true);
    expect($won)->not->toBeNull();

    $property = Property::query()->create([
        'address_line1' => '10 Automation Row',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'terraced',
        'created_by' => $user->id,
    ]);

    $contact = Contact::query()->create([
        'first_name' => 'Investor',
        'last_name' => 'Test',
        'email' => 'investor-'.uniqid().'@automation.test',
        'created_by' => $user->id,
    ]);

    $pipe = app(PipelineService::class);
    $deal = $pipe->createDeal([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stages->first()->id,
        'title' => 'Automation target deal',
        'property_id' => $property->id,
        'contact_id' => $contact->id,
        'deal_value' => 250000,
    ], $user);

    WorkspaceAutomationRun::query()->delete();

    $pipe->moveDeal($deal, (int) $won->id, $user);

    expect(WorkspaceAutomationRun::query()->count())->toBeGreaterThan(0);
    expect(WorkspaceAutomationRun::query()->where('status', 'success')->exists())->toBeTrue();

    $fresh = PipelineDeal::query()->with('activities')->findOrFail($deal->id);
    $hasCarinaBrief = $fresh->activities->contains(function ($row): bool {
        $m = $row->metadata;

        return is_array($m) && isset($m['carina_brief']) && is_string($m['carina_brief']) && $m['carina_brief'] !== '';
    });
    expect($hasCarinaBrief)->toBeTrue();

    expect(
        ComplianceItem::query()->where('property_id', $property->id)->where('type', 'other')->exists()
    )->toBeTrue();

    expect(JournalEntry::query()->where('reference', 'AUTO-PIPE-'.$deal->id)->exists())->toBeTrue();

    expect(
        CommunicationEnrollment::query()->where('contact_id', $contact->id)->where('pipeline_deal_id', $deal->id)->exists()
    )->toBeTrue();

    tenancy()->end();
});

it('skips journal draft when the acting user cannot manage accounting', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Automation No Journal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@automation-nj.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    TenantRole::findOrCreate('viewer', 'web');
    $user->syncRoles(['viewer']);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $pipeline = Pipeline::query()->where('is_default', true)->firstOrFail();
    $stages = PipelineStage::query()->where('pipeline_id', $pipeline->id)->ordered()->get();
    $won = $stages->firstWhere('is_won', true);
    expect($won)->not->toBeNull();

    $property = Property::query()->create([
        'address_line1' => '11 No Journal Row',
        'city' => 'Manchester',
        'postcode' => 'M1 1AA',
        'property_type' => 'terraced',
        'created_by' => $user->id,
    ]);

    $contact = Contact::query()->create([
        'first_name' => 'Investor',
        'last_name' => 'NJ',
        'email' => 'investor-'.uniqid().'@automation-nj.test',
        'created_by' => $user->id,
    ]);

    $pipe = app(PipelineService::class);
    $deal = $pipe->createDeal([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stages->first()->id,
        'title' => 'No journal deal',
        'property_id' => $property->id,
        'contact_id' => $contact->id,
        'deal_value' => 125000,
    ], $user);

    WorkspaceAutomationRun::query()->delete();

    $pipe->moveDeal($deal, (int) $won->id, $user);

    expect(JournalEntry::query()->where('reference', 'AUTO-PIPE-'.$deal->id)->exists())->toBeFalse();
    expect(
        CommunicationEnrollment::query()->where('contact_id', $contact->id)->where('pipeline_deal_id', $deal->id)->exists()
    )->toBeTrue();

    tenancy()->end();
});
