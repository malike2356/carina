<?php

declare(strict_types=1);

use App\Jobs\Communications\ProcessCommunicationStepJob;
use App\Models\Tenant\CommunicationEnrollment;
use App\Models\Tenant\CommunicationEnrollmentStepCompletion;
use App\Models\Tenant\CommunicationSequence;
use App\Models\Tenant\CommunicationStep;
use App\Models\Tenant\Contact;
use App\Models\Tenant\EmailTemplate;
use App\Models\Tenant\User;
use App\Services\Communications\CommunicationEnrollmentService;
use App\Services\Communications\CommunicationTemplateTokenService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function (): void {
    Mail::fake();
});

it('tracks multi-step enrollment completion and delayed scheduling', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Comms Life '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@comms-life.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $contact = Contact::query()->create([
        'first_name' => 'A',
        'last_name' => 'B',
        'email' => 'c-'.uniqid().'@comms-life.test',
        'created_by' => $user->id,
    ]);

    $seqImmediate = CommunicationSequence::query()->create([
        'slug' => 'test_seq_'.Str::lower(Str::random(6)),
        'name' => 'Two-step immediate',
        'description' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $seqImmediate->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'email',
        'subject' => 'One',
        'body' => 'Hi {{first_name}}',
        'is_active' => true,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $seqImmediate->id,
        'step_order' => 1,
        'delay_hours' => 0,
        'channel' => 'email',
        'subject' => 'Two',
        'body' => 'Again {{first_name}}',
        'is_active' => true,
    ]);

    $enrollmentA = CommunicationEnrollment::query()->create([
        'sequence_id' => $seqImmediate->id,
        'contact_id' => $contact->id,
        'pipeline_deal_id' => null,
        'context_type' => null,
        'context_id' => null,
        'status' => CommunicationEnrollment::STATUS_ACTIVE,
        'current_step' => 0,
        'enrolled_at' => now(),
    ]);

    $service = app(CommunicationEnrollmentService::class);
    $ctx = [
        'pipeline_deal_id' => 0,
        'deal_title' => 'T',
        'contact_id' => $contact->id,
        'created_by' => $user->id,
    ];

    $service->kickoffSteps($enrollmentA, $ctx);

    $enrollmentA->refresh();
    expect($enrollmentA->status)->toBe(CommunicationEnrollment::STATUS_COMPLETED)
        ->and($enrollmentA->completed_at)->not->toBeNull()
        ->and(CommunicationEnrollmentStepCompletion::query()->where('enrollment_id', $enrollmentA->id)->count())->toBe(2);

    $seqDelayed = CommunicationSequence::query()->create([
        'slug' => 'test_delay_'.Str::lower(Str::random(6)),
        'name' => 'Delayed step',
        'description' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $seqDelayed->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'email',
        'subject' => 'Now',
        'body' => 'Hi {{first_name}}',
        'is_active' => true,
    ]);

    $stepLater = CommunicationStep::query()->create([
        'sequence_id' => $seqDelayed->id,
        'step_order' => 1,
        'delay_hours' => 1,
        'channel' => 'email',
        'subject' => 'Later',
        'body' => 'Later {{first_name}}',
        'is_active' => true,
    ]);

    $enrollmentB = CommunicationEnrollment::query()->create([
        'sequence_id' => $seqDelayed->id,
        'contact_id' => $contact->id,
        'pipeline_deal_id' => null,
        'context_type' => null,
        'context_id' => null,
        'status' => CommunicationEnrollment::STATUS_ACTIVE,
        'current_step' => 0,
        'enrolled_at' => now(),
    ]);

    Queue::fake();
    $service->kickoffSteps($enrollmentB, $ctx);

    Queue::assertPushed(ProcessCommunicationStepJob::class);

    $enrollmentB->refresh();
    expect($enrollmentB->status)->toBe(CommunicationEnrollment::STATUS_ACTIVE)
        ->and($enrollmentB->completed_at)->toBeNull()
        ->and(CommunicationEnrollmentStepCompletion::query()->where('enrollment_id', $enrollmentB->id)->count())->toBe(1);

    $service->sendStepNow($enrollmentB->fresh(), $stepLater->fresh(), $ctx);

    $enrollmentB->refresh();
    expect($enrollmentB->status)->toBe(CommunicationEnrollment::STATUS_COMPLETED)
        ->and(CommunicationEnrollmentStepCompletion::query()->where('enrollment_id', $enrollmentB->id)->count())->toBe(2);

    tenancy()->end();
});

it('completes a delayed-only step via ProcessCommunicationStepJob', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Comms Job '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@comms-job.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $contact = Contact::query()->create([
        'first_name' => 'Job',
        'last_name' => 'Test',
        'email' => 'c-'.uniqid().'@comms-job.test',
        'created_by' => $user->id,
    ]);

    $seq = CommunicationSequence::query()->create([
        'slug' => 'test_job_'.Str::lower(Str::random(6)),
        'name' => 'Delayed only',
        'description' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    $delayedStep = CommunicationStep::query()->create([
        'sequence_id' => $seq->id,
        'step_order' => 0,
        'delay_hours' => 1,
        'channel' => 'email',
        'subject' => 'Waited',
        'body' => 'Hello {{first_name}}',
        'is_active' => true,
    ]);

    $enrollment = CommunicationEnrollment::query()->create([
        'sequence_id' => $seq->id,
        'contact_id' => $contact->id,
        'pipeline_deal_id' => null,
        'context_type' => null,
        'context_id' => null,
        'status' => CommunicationEnrollment::STATUS_ACTIVE,
        'current_step' => 0,
        'enrolled_at' => now(),
    ]);

    Queue::fake();
    app(CommunicationEnrollmentService::class)->kickoffSteps($enrollment, [
        'pipeline_deal_id' => 0,
        'deal_title' => 'T',
        'contact_id' => $contact->id,
        'created_by' => $user->id,
    ]);

    Queue::assertPushed(ProcessCommunicationStepJob::class, 1);

    $enrollment->refresh();
    expect($enrollment->status)->toBe(CommunicationEnrollment::STATUS_ACTIVE)
        ->and(CommunicationEnrollmentStepCompletion::query()->where('enrollment_id', $enrollment->id)->count())->toBe(0);

    $job = new ProcessCommunicationStepJob((string) $tenant->id, $enrollment->id, $delayedStep->id);
    $job->handle(
        app(CommunicationEnrollmentService::class),
        app(CommunicationTemplateTokenService::class),
    );

    $enrollment->refresh();
    expect($enrollment->status)->toBe(CommunicationEnrollment::STATUS_COMPLETED)
        ->and(CommunicationEnrollmentStepCompletion::query()->where('enrollment_id', $enrollment->id)->count())->toBe(1);

    tenancy()->end();
});

it('sends an EmailTemplate when the step uses email_template_slug', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Comms Template '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@comms-tpl.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $contact = Contact::query()->create([
        'first_name' => 'Sam',
        'last_name' => 'T',
        'email' => 'c-'.uniqid().'@comms-tpl.test',
        'created_by' => $user->id,
    ]);

    $tplSlug = 'comms_seq_tpl_'.Str::lower(Str::random(6));

    EmailTemplate::query()->create([
        'tenant_id' => (string) tenant()->getTenantKey(),
        'created_by' => $user->id,
        'slug' => $tplSlug,
        'name' => 'Comms step fixture',
        'category' => 'general',
        'subject' => 'Hello {{first_name}} from template',
        'body_html' => '<p>Body for {{first_name}}</p>',
        'is_active' => true,
        'is_system' => false,
    ]);

    $seq = CommunicationSequence::query()->create([
        'slug' => 'test_tpl_'.Str::lower(Str::random(6)),
        'name' => 'Template step',
        'description' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $seq->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'email',
        'email_template_slug' => $tplSlug,
        'subject' => '',
        'body' => '',
        'is_active' => true,
    ]);

    $enrollment = CommunicationEnrollment::query()->create([
        'sequence_id' => $seq->id,
        'contact_id' => $contact->id,
        'pipeline_deal_id' => null,
        'context_type' => null,
        'context_id' => null,
        'status' => CommunicationEnrollment::STATUS_ACTIVE,
        'current_step' => 0,
        'enrolled_at' => now(),
    ]);

    $service = app(CommunicationEnrollmentService::class);
    $service->kickoffSteps($enrollment, [
        'pipeline_deal_id' => 0,
        'deal_title' => 'Example deal',
        'contact_id' => $contact->id,
        'created_by' => $user->id,
    ]);

    $row = CommunicationEnrollmentStepCompletion::query()
        ->where('enrollment_id', $enrollment->id)
        ->first();

    expect($row)->not->toBeNull()
        ->and($row->outcome)->toBe(CommunicationEnrollmentStepCompletion::OUTCOME_SENT);

    tenancy()->end();
});
