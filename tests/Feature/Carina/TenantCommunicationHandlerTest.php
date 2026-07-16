<?php

declare(strict_types=1);

use App\Mail\TenantMessageMail;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenantCommunicationLog;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\ToolHandlers\TenantCommunicationHandler;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Mail;

/**
 * @return array{0: Tenant, 1: User}
 */
function tenantCommsTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Tenant Comms '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@tenantcomms.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function tenantCommsConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Tenant communication test',
    ]);
}

function tenantCommsProperty(User $user, string $address = 'Flat 4, 106 Chichester Road'): Property
{
    return Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => $address,
        'city' => 'Portsmouth',
        'postcode' => 'PO4 0AA',
        'property_type' => 'flat',
        'bedrooms' => 2,
    ]);
}

function tenantCommsTenancy(Property $property, string $email = 'tenant@example.test'): PropertyTenancy
{
    return PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Alex Tenant',
        'email' => $email,
        'phone' => '+447700900123',
        'start_date' => now()->subMonths(3)->toDateString(),
        'rent_amount' => 950.00,
        'rent_due_day' => 1,
        'tenancy_type' => 'ast',
    ]);
}

it('draft_tenant_message creates pending approval log without sending mail', function (): void {
    Mail::fake();

    [$tenant, $user] = tenantCommsTenant();
    tenancy()->initialize($tenant);

    $property = tenantCommsProperty($user);
    tenantCommsTenancy($property);

    $conversation = tenantCommsConversation($tenant, $user);

    $result = app(TenantCommunicationHandler::class)->handle(
        'draft_tenant_message',
        [
            'property_reference' => 'Chichester',
            'message_type' => 'rent_reminder',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['channel'])->toBe('email')
        ->and($result->data['subject'])->toContain('Rent Reminder')
        ->and($result->data['body'])->toContain('Alex Tenant');

    $log = TenantCommunicationLog::query()->find($result->data['draft_id']);
    expect($log)->not->toBeNull()
        ->and($log->status)->toBe('pending_approval')
        ->and($log->sent_at)->toBeNull();

    Mail::assertNotSent(TenantMessageMail::class);
    tenancy()->end();
});

it('send_tenant_message rejects when approved is false', function (): void {
    Mail::fake();

    [$tenant, $user] = tenantCommsTenant();
    tenancy()->initialize($tenant);

    $property = tenantCommsProperty($user);
    $tenancy = tenantCommsTenancy($property);

    $log = TenantCommunicationLog::query()->create([
        'property_id' => $property->id,
        'property_tenancy_id' => $tenancy->id,
        'sent_by_user_id' => $user->id,
        'channel' => 'email',
        'message_type' => 'general',
        'subject' => 'Test',
        'body' => 'Hello',
        'status' => 'pending_approval',
    ]);

    $conversation = tenantCommsConversation($tenant, $user);

    $result = app(TenantCommunicationHandler::class)->handle(
        'send_tenant_message',
        ['draft_id' => $log->id, 'approved' => false],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and($result->error)->toBe('approval_required');

    Mail::assertNotSent(TenantMessageMail::class);
    expect($log->fresh()->status)->toBe('pending_approval');
    tenancy()->end();
});

it('send_tenant_message sends email when approved', function (): void {
    Mail::fake();

    [$tenant, $user] = tenantCommsTenant();
    tenancy()->initialize($tenant);

    $property = tenantCommsProperty($user);
    $tenancy = tenantCommsTenancy($property);

    $log = TenantCommunicationLog::query()->create([
        'property_id' => $property->id,
        'property_tenancy_id' => $tenancy->id,
        'sent_by_user_id' => $user->id,
        'channel' => 'email',
        'message_type' => 'rent_reminder',
        'subject' => 'Rent Reminder',
        'body' => 'Please pay rent.',
        'status' => 'pending_approval',
    ]);

    $conversation = tenantCommsConversation($tenant, $user);

    $result = app(TenantCommunicationHandler::class)->handle(
        'send_tenant_message',
        ['draft_id' => $log->id, 'approved' => true],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['status'])->toBe('sent')
        ->and($log->fresh()->status)->toBe('sent')
        ->and($log->fresh()->sent_at)->not->toBeNull();

    Mail::assertSent(TenantMessageMail::class, function (TenantMessageMail $mail): bool {
        return $mail->hasTo('tenant@example.test')
            && $mail->subjectLine === 'Rent Reminder'
            && str_contains($mail->body, 'Please pay rent.');
    });

    tenancy()->end();
});

it('list_tenant_communications returns property history', function (): void {
    [$tenant, $user] = tenantCommsTenant();
    tenancy()->initialize($tenant);

    $property = tenantCommsProperty($user);
    $tenancy = tenantCommsTenancy($property);

    TenantCommunicationLog::query()->create([
        'property_id' => $property->id,
        'property_tenancy_id' => $tenancy->id,
        'sent_by_user_id' => $user->id,
        'channel' => 'email',
        'message_type' => 'general',
        'subject' => 'Hello',
        'body' => 'Previous message',
        'status' => 'sent',
        'sent_at' => now()->subDay(),
    ]);

    $conversation = tenantCommsConversation($tenant, $user);

    $result = app(TenantCommunicationHandler::class)->handle(
        'list_tenant_communications',
        ['property_reference' => 'Flat 4'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['total'])->toBe(1)
        ->and($result->data['communications'][0]['status'])->toBe('sent')
        ->and($result->data['communications'][0]['to'])->toBe('Alex Tenant');

    tenancy()->end();
});

it('draft_tenant_message fails when property has no active tenancy', function (): void {
    [$tenant, $user] = tenantCommsTenant();
    tenancy()->initialize($tenant);

    tenantCommsProperty($user);
    $conversation = tenantCommsConversation($tenant, $user);

    $result = app(TenantCommunicationHandler::class)->handle(
        'draft_tenant_message',
        ['property_reference' => 'Chichester', 'message_type' => 'general'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and($result->summary)->toContain('No active tenant');

    tenancy()->end();
});

it('dispatches draft_tenant_message via CarinaModuleToolDispatcher', function (): void {
    Mail::fake();

    [$tenant, $user] = tenantCommsTenant();
    tenancy()->initialize($tenant);

    $property = tenantCommsProperty($user);
    tenantCommsTenancy($property);

    app()->forgetInstance(CarinaModuleToolDispatcher::class);

    $conversation = tenantCommsConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'draft_tenant_message',
        ['property_reference' => '106 Chichester Road', 'message_type' => 'general'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data)->toHaveKey('draft_id');

    tenancy()->end();
});

it('send_tenant_message requires confirmation in tool registry', function (): void {
    $tool = app(CarinaToolRegistry::class)->find('send_tenant_message');

    expect($tool)->not->toBeNull()
        ->and($tool->requiresConfirmation())->toBeTrue();
});
