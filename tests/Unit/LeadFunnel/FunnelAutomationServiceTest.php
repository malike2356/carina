<?php

declare(strict_types=1);

use App\Jobs\LeadFunnel\CarinaQualifyLeadJob;
use App\Jobs\LeadFunnel\ExecuteAutomationJob;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Contact;
use App\Models\Tenant\LeadFunnel\AutomationLog;
use App\Models\Tenant\LeadFunnel\FunnelAutomation;
use App\Models\Tenant\LeadFunnel\FunnelStage;
use App\Services\LeadFunnel\FunnelAutomationService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $service = app(TenantCreationService::class);
    $this->tenant = $service->createTenant([
        'company_name' => 'AutoTest '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'auto-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);
    $this->tenantId = (string) $this->tenant->getKey();
    tenancy()->initialize($this->tenant);
    FeatureFlag::syncFromCatalogue();
});

afterEach(function (): void {
    tenancy()->end();
});

it('stage_entered dispatches an ExecuteAutomationJob for a matching automation', function (): void {
    Queue::fake();

    $stage = FunnelStage::query()->create(['tenant_id' => $this->tenantId, 'name' => 'Prospect', 'position' => 1]);
    $contact = Contact::factory()->create(['type' => 'investor', 'lead_funnel_stage_id' => $stage->id]);
    FunnelAutomation::query()->create([
        'tenant_id' => $this->tenantId, 'stage_id' => $stage->id,
        'name' => 'Welcome', 'trigger' => 'stage_entered',
        'delay_hours' => 0, 'action' => 'add_tag',
        'action_config' => ['tag' => 'new-prospect'],
        'segment_filter' => 'all', 'is_active' => true,
    ]);

    app(FunnelAutomationService::class)->onStageEntered($contact->id, $stage->id, $this->tenantId);

    Queue::assertPushed(ExecuteAutomationJob::class);
});

it('stage_entered skips automations where segment filter does not match contact type', function (): void {
    Queue::fake();

    $stage = FunnelStage::query()->create(['tenant_id' => $this->tenantId, 'name' => 'Qualified', 'position' => 1]);
    $contact = Contact::factory()->create(['type' => 'seller', 'lead_funnel_stage_id' => $stage->id]);
    FunnelAutomation::query()->create([
        'tenant_id' => $this->tenantId, 'stage_id' => $stage->id,
        'name' => 'Investor Only', 'trigger' => 'stage_entered',
        'delay_hours' => 0, 'action' => 'add_tag',
        'action_config' => ['tag' => 'investor-tag'],
        'segment_filter' => 'investor', 'is_active' => true,
    ]);

    app(FunnelAutomationService::class)->onStageEntered($contact->id, $stage->id, $this->tenantId);

    Queue::assertNothingPushed();
});

it('stage_entered does not dispatch when stage id is zero', function (): void {
    Queue::fake();

    $contact = Contact::factory()->create(['lead_funnel_stage_id' => null]);

    app(FunnelAutomationService::class)->onStageEntered($contact->id, 0, $this->tenantId);

    Queue::assertNothingPushed();
});

it('execute_automation creates an automation log with executed status', function (): void {
    Queue::fake();

    $stage = FunnelStage::query()->create(['tenant_id' => $this->tenantId, 'name' => 'Stage A', 'position' => 1]);
    $contact = Contact::factory()->create(['tags' => []]);
    $automation = FunnelAutomation::query()->create([
        'tenant_id' => $this->tenantId, 'stage_id' => $stage->id,
        'name' => 'Tag Action', 'trigger' => 'stage_entered',
        'delay_hours' => 0, 'action' => 'add_tag',
        'action_config' => ['tag' => 'test-tag'],
        'segment_filter' => 'all', 'is_active' => true,
    ]);

    app(FunnelAutomationService::class)->executeAutomation($automation, $contact->id);

    $log = AutomationLog::query()->where('automation_id', $automation->id)->first();
    expect($log)->not->toBeNull()
        ->and($log->status)->toBe('executed');
});

it('execute_automation adds the configured tag to the contact', function (): void {
    Queue::fake();

    $stage = FunnelStage::query()->create(['tenant_id' => $this->tenantId, 'name' => 'Stage B', 'position' => 1]);
    $contact = Contact::factory()->create(['tags' => []]);
    $automation = FunnelAutomation::query()->create([
        'tenant_id' => $this->tenantId, 'stage_id' => $stage->id,
        'name' => 'Tag Hot', 'trigger' => 'stage_entered',
        'delay_hours' => 0, 'action' => 'add_tag',
        'action_config' => ['tag' => 'hot-lead'],
        'segment_filter' => 'all', 'is_active' => true,
    ]);

    app(FunnelAutomationService::class)->executeAutomation($automation, $contact->id);

    expect($contact->fresh()->tags)->toContain('hot-lead');
});

it('execute_automation records failure status when the action throws', function (): void {
    $stage = FunnelStage::query()->create(['tenant_id' => $this->tenantId, 'name' => 'Stage C', 'position' => 1]);
    $contact = Contact::factory()->create();
    $automation = FunnelAutomation::query()->create([
        'tenant_id' => $this->tenantId, 'stage_id' => $stage->id,
        'name' => 'Webhook Fail', 'trigger' => 'stage_entered',
        'delay_hours' => 0, 'action' => 'webhook_post',
        'action_config' => ['url' => ''],
        'segment_filter' => 'all', 'is_active' => true,
    ]);

    app(FunnelAutomationService::class)->executeAutomation($automation, $contact->id);

    $log = AutomationLog::query()->where('automation_id', $automation->id)->first();
    expect($log?->status)->toBe('failed');
});

it('execute_automation queues a CarinaQualifyLeadJob when action is carina_qualify', function (): void {
    Queue::fake();

    $stage = FunnelStage::query()->create(['tenant_id' => $this->tenantId, 'name' => 'Stage D', 'position' => 1]);
    $contact = Contact::factory()->create();
    $automation = FunnelAutomation::query()->create([
        'tenant_id' => $this->tenantId, 'stage_id' => $stage->id,
        'name' => 'Carina Qualify', 'trigger' => 'stage_entered',
        'delay_hours' => 0, 'action' => 'carina_qualify',
        'action_config' => [],
        'segment_filter' => 'all', 'is_active' => true,
    ]);

    app(FunnelAutomationService::class)->executeAutomation($automation, $contact->id);

    Queue::assertPushed(CarinaQualifyLeadJob::class);
});
