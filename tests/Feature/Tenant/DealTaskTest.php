<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Mail\Tenant\DealTaskReminderMail;
use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\DealTask;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelinePreset;
use App\Models\Tenant\User;
use App\Services\Pipeline\PipelinePresetService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: string, 2: User}
 */
function dealTaskBootTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Deal tasks '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@deal-task.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', BillingModule::Pipeline->value)->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    app(PipelinePresetService::class)->ensureSystemPresets();
    $preset = PipelinePreset::query()->where('slug', 'investors')->firstOrFail();
    app(PipelinePresetService::class)->createPipelineFromPreset($preset, null);
    $user = User::query()->firstOrFail();
    tenancy()->end();

    return [$tenant, $host, $user];
}

/**
 * @return array{pipeline: int, deal: int}
 */
function firstPipelineDealForTenant(Tenant $tenant): array
{
    tenancy()->initialize($tenant);
    $pipeline = Pipeline::query()->firstOrFail();
    $stage = $pipeline->stages()->orderBy('position')->firstOrFail();
    $deal = PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Test card',
        'position' => 0,
        'created_by' => User::query()->firstOrFail()->id,
    ]);
    $ids = ['pipeline' => $pipeline->id, 'deal' => $deal->id];
    tenancy()->end();

    return $ids;
}

it('creates assigns completes and scopes deal tasks', function (): void {
    [$tenant, $host, $owner] = dealTaskBootTenant();
    $ids = firstPipelineDealForTenant($tenant);

    tenancy()->initialize($tenant);
    $assignee = User::factory()->create(['name' => 'Assignee']);
    tenancy()->end();

    $this->actingAs($owner, 'web');

    $this->postJson('http://'.$host.'/deal-tasks', [
        'pipeline_deal_id' => $ids['deal'],
        'title' => 'Follow up vendor',
        'assigned_to' => $assignee->id,
        'due_at' => now()->addDay()->toDateString(),
    ])->assertCreated();

    tenancy()->initialize($tenant);
    $task = DealTask::query()->firstOrFail();
    expect($task->assigned_to)->toBe($assignee->id);
    tenancy()->end();

    $this->actingAs($assignee, 'web');
    $this->patchJson('http://'.$host.'/deal-tasks/'.$task->id.'/complete')->assertOk();

    tenancy()->initialize($tenant);
    expect(DealTask::query()->find($task->id)?->completed_at)->not->toBeNull();
    tenancy()->end();

    $this->actingAs($owner, 'web');
    $this->getJson('http://'.$host.'/deal-tasks?pipeline_deal_id='.$ids['deal'])
        ->assertOk()
        ->assertJsonCount(1, 'tasks');
});

it('sends reminder emails for due tasks', function (): void {
    Mail::fake();
    [$tenant, $host, $owner] = dealTaskBootTenant();
    $ids = firstPipelineDealForTenant($tenant);

    tenancy()->initialize($tenant);
    $assignee = User::factory()->create(['email' => 'assignee-'.uniqid().'@example.test']);
    DealTask::query()->create([
        'pipeline_deal_id' => $ids['deal'],
        'created_by' => $owner->id,
        'assigned_to' => $assignee->id,
        'title' => 'Due soon',
        'due_at' => now()->startOfDay()->addHours(12),
    ]);
    tenancy()->end();

    Artisan::call('deal-tasks:send-reminders');

    Mail::assertSent(DealTaskReminderMail::class);
});
