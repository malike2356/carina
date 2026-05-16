<?php

declare(strict_types=1);

use App\Models\Tenant\CommunicationEnrollment;
use App\Models\Tenant\CommunicationEnrollmentStepCompletion;
use App\Models\Tenant\CommunicationSequence;
use App\Models\Tenant\CommunicationStep;
use App\Models\Tenant\Contact;
use App\Models\Tenant\User;
use App\Services\Communications\CommunicationEnrollmentService;
use App\Services\Integrations\SmsService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Str;

afterEach(function (): void {
    Mockery::close();
});

it('skips sms step when contact has no phone number', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SMS Skip '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sms-skip.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $contact = Contact::query()->create([
        'first_name' => 'No',
        'last_name' => 'Phone',
        'email' => 'np-'.uniqid().'@sms-skip.test',
        'phone' => null,
        'created_by' => $user->id,
    ]);

    $seq = CommunicationSequence::query()->create([
        'slug' => 'sms_skip_'.Str::lower(Str::random(6)),
        'name' => 'SMS skip',
        'description' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $seq->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'sms',
        'subject' => 'Hi',
        'body' => 'Hello {{first_name}}',
        'is_active' => true,
    ]);

    $sms = Mockery::mock(SmsService::class);
    $sms->shouldNotReceive('sendSms');
    app()->instance(SmsService::class, $sms);

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

    app(CommunicationEnrollmentService::class)->kickoffSteps($enrollment, [
        'pipeline_deal_id' => 0,
        'deal_title' => '',
        'contact_id' => $contact->id,
        'created_by' => $user->id,
    ]);

    $row = CommunicationEnrollmentStepCompletion::query()
        ->where('enrollment_id', $enrollment->id)
        ->first();

    expect($row)->not->toBeNull()
        ->and($row->outcome)->toBe(CommunicationEnrollmentStepCompletion::OUTCOME_SKIPPED);

    tenancy()->end();
});

it('sends sms when contact phone is present and marks step sent', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SMS Send '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sms-send.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $contact = Contact::query()->create([
        'first_name' => 'Sam',
        'last_name' => 'Mobile',
        'email' => 'sm-'.uniqid().'@sms-send.test',
        'phone' => '+44 7700 900123',
        'created_by' => $user->id,
    ]);

    $seq = CommunicationSequence::query()->create([
        'slug' => 'sms_ok_'.Str::lower(Str::random(6)),
        'name' => 'SMS ok',
        'description' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $seq->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'sms',
        'subject' => 'Hello',
        'body' => 'Hi {{first_name}}',
        'is_active' => true,
    ]);

    $sms = Mockery::mock(SmsService::class);
    $sms->shouldReceive('sendSms')
        ->once()
        ->with(Mockery::on(fn (string $to): bool => str_contains($to, '447700900123')), Mockery::type('string'))
        ->andReturn(['sid' => 'SM123', 'status' => 'queued']);
    app()->instance(SmsService::class, $sms);

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

    app(CommunicationEnrollmentService::class)->kickoffSteps($enrollment, [
        'pipeline_deal_id' => 0,
        'deal_title' => '',
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

it('skips sms when Twilio is not configured', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'SMS NC '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@sms-nc.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $user = User::query()->firstOrFail();
    $contact = Contact::query()->create([
        'first_name' => 'X',
        'last_name' => 'Y',
        'email' => 'xy-'.uniqid().'@sms-nc.test',
        'phone' => '+447700900456',
        'created_by' => $user->id,
    ]);

    $seq = CommunicationSequence::query()->create([
        'slug' => 'sms_nc_'.Str::lower(Str::random(6)),
        'name' => 'SMS not configured',
        'description' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $seq->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'sms',
        'subject' => 'S',
        'body' => 'Body',
        'is_active' => true,
    ]);

    $sms = Mockery::mock(SmsService::class);
    $sms->shouldReceive('sendSms')
        ->once()
        ->andReturn(['status' => 'error', 'message' => 'SMS provider is not configured.']);
    app()->instance(SmsService::class, $sms);

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

    app(CommunicationEnrollmentService::class)->kickoffSteps($enrollment, [
        'pipeline_deal_id' => 0,
        'deal_title' => '',
        'contact_id' => $contact->id,
        'created_by' => $user->id,
    ]);

    $row = CommunicationEnrollmentStepCompletion::query()
        ->where('enrollment_id', $enrollment->id)
        ->first();

    expect($row)->not->toBeNull()
        ->and($row->outcome)->toBe(CommunicationEnrollmentStepCompletion::OUTCOME_SKIPPED);

    tenancy()->end();
});
