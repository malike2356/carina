<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\EmailDigestItem;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyDocument;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\EmailActionHandler;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Storage;

/**
 * @return array{0: Tenant, 1: User}
 */
function emailActionTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Email Actions '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@emailactions.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function emailActionConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Email actions test',
    ]);
}

function emailActionProperty(User $user, string $address = '106 Chichester Road'): Property
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

it('auto_process_email attaches compliance document to identified property', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);
    Storage::fake('local');

    $property = emailActionProperty($user);
    $filePath = sys_get_temp_dir().'/gas_cert_'.uniqid().'.pdf';
    file_put_contents($filePath, '%PDF-1.4 gas safety certificate');

    $conversation = emailActionConversation($tenant, $user);

    $result = app(EmailActionHandler::class)->handle(
        'auto_process_email',
        [
            'email_id' => 'msg-'.uniqid(),
            'subject' => 'Gas certificate for 106 Chichester Road',
            'body' => 'Please find attached the CP12 gas safety certificate.',
            'from' => 'agent@lettings.test',
            'classification' => 'compliance_document',
            'attachments' => [
                ['path' => $filePath, 'name' => 'gas-cert.pdf'],
            ],
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['action_count'])->toBe(1)
        ->and($result->data['actions'][0]['type'])->toBe('document_attached')
        ->and($result->data['actions'][0]['action_taken'])->toBe('attached')
        ->and(PropertyDocument::query()->where('property_id', $property->id)->count())->toBe(1);

    @unlink($filePath);
    tenancy()->end();
});

it('auto_process_email flags maintenance request with summary', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    emailActionProperty($user);
    $conversation = emailActionConversation($tenant, $user);
    $emailId = 'maint-'.uniqid();

    $result = app(EmailActionHandler::class)->handle(
        'auto_process_email',
        [
            'email_id' => $emailId,
            'subject' => 'Boiler not working at 106 Chichester Road',
            'body' => 'The boiler has stopped heating water. Tenant reports no hot water since yesterday morning.',
            'from' => 'tenant@example.test',
            'classification' => 'maintenance_request',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['actions'][0]['type'])->toBe('flagged')
        ->and($result->data['actions'][0]['category'])->toBe('maintenance');

    $digest = EmailDigestItem::query()->where('email_id', $emailId)->first();
    expect($digest)->not->toBeNull()
        ->and($digest->classification)->toBe('maintenance_request');

    tenancy()->end();
});

it('auto_process_email flags legal emails as high priority', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    $conversation = emailActionConversation($tenant, $user);
    $emailId = 'legal-'.uniqid();

    $result = app(EmailActionHandler::class)->handle(
        'auto_process_email',
        [
            'email_id' => $emailId,
            'subject' => 'Completion documents',
            'body' => 'Please review the attached contract for completion next week.',
            'from' => 'solicitor@law.test',
            'classification' => 'solicitor',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['actions'][0]['priority'])->toBe('high');

    $digest = EmailDigestItem::query()->where('email_id', $emailId)->first();
    expect($digest?->priority)->toBe('high');

    tenancy()->end();
});

it('auto_process_email extracts payment amount from receipt', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    $conversation = emailActionConversation($tenant, $user);

    $result = app(EmailActionHandler::class)->handle(
        'auto_process_email',
        [
            'email_id' => 'pay-'.uniqid(),
            'subject' => 'Rent received',
            'body' => 'We have received rent payment of £1,250.00 for March.',
            'from' => 'agent@lettings.test',
            'classification' => 'payment_receipt',
            'property_reference' => 'Chichester',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['actions'][0]['amount'])->toBe(1250.0);

    tenancy()->end();
});

it('auto_process_email marks unknown property compliance attachment for review', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    $filePath = sys_get_temp_dir().'/orphan_'.uniqid().'.pdf';
    file_put_contents($filePath, '%PDF-1.4 certificate');
    $conversation = emailActionConversation($tenant, $user);

    $result = app(EmailActionHandler::class)->handle(
        'auto_process_email',
        [
            'email_id' => 'orphan-'.uniqid(),
            'subject' => 'Gas certificate',
            'body' => 'Certificate attached.',
            'from' => 'agent@lettings.test',
            'classification' => 'compliance_document',
            'attachments' => [
                ['path' => $filePath, 'name' => 'gas.pdf'],
            ],
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['actions'][0]['type'])->toBe('needs_review')
        ->and(PropertyDocument::query()->count())->toBe(0);

    @unlink($filePath);
    tenancy()->end();
});

it('email_digest returns unread items with high priority first', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    EmailDigestItem::query()->create([
        'email_id' => 'digest-normal-'.uniqid(),
        'subject' => 'Mortgage statement',
        'from' => 'bank@test',
        'classification' => 'mortgage',
        'actions_json' => [['type' => 'document_attached']],
        'priority' => 'normal',
        'reviewed' => false,
    ]);

    EmailDigestItem::query()->create([
        'email_id' => 'digest-high-'.uniqid(),
        'subject' => 'Urgent legal notice',
        'from' => 'solicitor@test',
        'classification' => 'solicitor',
        'actions_json' => [['type' => 'flagged', 'priority' => 'high']],
        'priority' => 'high',
        'reviewed' => false,
    ]);

    $conversation = emailActionConversation($tenant, $user);

    $result = app(EmailActionHandler::class)->handle(
        'email_digest',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['total_processed'])->toBe(2)
        ->and($result->data['high_priority'])->toBe(1)
        ->and($result->data['items'][0]['priority'])->toBe('high');

    tenancy()->end();
});

it('search_emails finds items by keyword and classification', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    EmailDigestItem::query()->create([
        'email_id' => 'search-'.uniqid(),
        'subject' => 'Halifax mortgage statement',
        'from' => 'halifax@bank.test',
        'classification' => 'mortgage',
        'actions_json' => [['type' => 'document_attached']],
        'priority' => 'normal',
        'reviewed' => false,
    ]);

    $conversation = emailActionConversation($tenant, $user);
    $handler = app(EmailActionHandler::class);

    $byKeyword = $handler->handle('search_emails', ['query' => 'Halifax'], $user, $conversation);
    $byClass = $handler->handle('search_emails', ['classification' => 'mortgage'], $user, $conversation);

    expect($byKeyword->success)->toBeTrue()
        ->and($byKeyword->data['total'])->toBe(1)
        ->and($byClass->data['total'])->toBe(1);

    tenancy()->end();
});

it('flag_email_for_review stores high priority digest item', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    $conversation = emailActionConversation($tenant, $user);
    $emailId = 'flag-'.uniqid();

    $result = app(EmailActionHandler::class)->handle(
        'flag_email_for_review',
        [
            'email_id' => $emailId,
            'reason' => 'Unusual sender domain',
            'subject' => 'Unknown invoice',
            'from' => 'unknown@test',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue();

    $digest = EmailDigestItem::query()->where('email_id', $emailId)->first();
    expect($digest?->priority)->toBe('high')
        ->and($digest?->classification)->toBe('flagged');

    tenancy()->end();
});

it('dispatches auto_process_email via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = emailActionTenant();
    tenancy()->initialize($tenant);

    app()->forgetInstance(CarinaModuleToolDispatcher::class);
    $conversation = emailActionConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'auto_process_email',
        [
            'email_id' => 'dispatch-'.uniqid(),
            'subject' => 'Tenant update',
            'body' => 'Please call me about the lease renewal.',
            'from' => 'tenant@example.test',
            'classification' => 'tenant_communication',
            'property_reference' => '106 Chichester Road',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['actions'][0]['category'])->toBe('tenant_message');

    tenancy()->end();
});
