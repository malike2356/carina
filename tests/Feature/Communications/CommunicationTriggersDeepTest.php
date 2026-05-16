<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CommunicationEnrollment;
use App\Models\Tenant\CommunicationSequence;
use App\Models\Tenant\CommunicationStep;
use App\Models\Tenant\Contact;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Pipeline;
use App\Models\Tenant\PipelineDeal;
use App\Models\Tenant\PipelineStage;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Communications\CommunicationSequenceTriggers;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function (): void {
    Mail::fake();
    Queue::fake();
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'communications_hub')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'pipeline')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('enrols pipeline contacts when deal analysis status changes and sequence matches to_status', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Comms Deep '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@comms-deep.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $pipeline = Pipeline::query()->firstOrFail();
    $stage = PipelineStage::query()->where('pipeline_id', $pipeline->id)->orderBy('position')->firstOrFail();

    $contact = Contact::query()->create([
        'first_name' => 'Sam',
        'last_name' => 'Investor',
        'email' => 'sam-'.Str::lower(Str::random(8)).'@comms-deep.test',
        'created_by' => $user->id,
    ]);

    $analysis = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Test deal',
        'metrics' => [],
        'status' => 'draft',
    ]);

    PipelineDeal::query()->create([
        'pipeline_id' => $pipeline->id,
        'stage_id' => $stage->id,
        'title' => 'Card',
        'deal_analysis_id' => $analysis->id,
        'property_id' => null,
        'contact_id' => $contact->id,
        'created_by' => $user->id,
        'position' => 0,
    ]);

    $slug = 'status_seq_'.Str::lower(Str::random(6));
    $sequence = CommunicationSequence::query()->create([
        'slug' => $slug,
        'name' => 'On shared',
        'description' => null,
        'trigger_key' => CommunicationSequenceTriggers::DEAL_STATUS_CHANGED,
        'trigger_config' => ['to_status' => 'shared'],
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $sequence->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'email',
        'subject' => 'Deal update',
        'body' => 'Hi {{first_name}} — {{deal.title}}',
        'is_active' => true,
    ]);

    expect(CommunicationEnrollment::query()->count())->toBe(0);

    $analysis->update(['status' => 'shared']);

    expect(CommunicationEnrollment::query()->where('contact_id', $contact->id)->where('sequence_id', $sequence->id)->count())->toBe(1);
    tenancy()->end();
});
