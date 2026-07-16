<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\Contact;
use App\Models\Tenant\ContactInteraction;
use App\Models\Tenant\ContactThread;
use App\Models\Tenant\ContactThreadMessage;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{tenant: Tenant, host: string, user: User}
 */
function crmInboxShared(): array
{
    static $shared = null;

    if ($shared !== null) {
        return $shared;
    }

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'CRM Inbox Shared',
        'owner_name' => 'Owner',
        'owner_email' => 'owner-crm-inbox-shared@crm-inbox.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'communications_hub')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $shared = [
        'tenant' => $tenant,
        'host' => $host,
        'user' => $user,
    ];

    return $shared;
}

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);

    config([
        'services.inbound_email_webhook.mailgun_signing_key' => 'test-mailgun-signing-key',
        'services.inbound_email_webhook.postmark_server_token' => '',
        'services.inbound_email_webhook.shared_secret' => '',
        'services.inbound_email_webhook.require_signature' => true,
    ]);
});

/**
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function crmInboxMailgunSignedPayload(array $fields): array
{
    $timestamp = (string) time();
    $token = 'webhook-token-'.uniqid();

    return array_merge($fields, [
        'timestamp' => $timestamp,
        'token' => $token,
        'signature' => hash_hmac('sha256', $timestamp.$token, 'test-mailgun-signing-key'),
    ]);
}

it('creates a thread and sends an outbound email', function (): void {
    Mail::fake();
    config(['mail.inbound_domain' => 'reply.propreneur.test']);

    $shared = crmInboxShared();
    $tenant = $shared['tenant'];
    $host = $shared['host'];
    $user = $shared['user'];

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create([
        'email' => 'contact-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->post('http://'.$host.'/communications/inbox/threads', [
        'contact_id' => $contact->id,
        'subject' => 'Initial outreach',
        'body' => 'Hello, following up on your enquiry.',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('status', 'thread-created');

    tenancy()->initialize($tenant);

    $thread = ContactThread::query()->where('contact_id', $contact->id)->latest('id')->first();
    expect($thread)->not->toBeNull()
        ->and($thread->subject)->toBe('Initial outreach')
        ->and($thread->reply_token)->not->toBeEmpty();

    $message = ContactThreadMessage::query()
        ->where('thread_id', $thread->id)
        ->where('direction', 'outbound')
        ->first();
    expect($message)->not->toBeNull()
        ->and($message->body_text)->toContain('Hello')
        ->and($message->reply_to)->toBe('replies+'.$tenant->slug.'--'.$thread->reply_token.'@reply.propreneur.test');

    expect(ContactInteraction::query()->where('contact_id', $contact->id)->where('type', 'email_sent')->exists())->toBeTrue();

    $contact->refresh();
    expect($contact->last_contacted_at)->not->toBeNull();

    Mail::assertSentCount(1);
    tenancy()->end();
});

it('adds an internal note without sending email', function (): void {
    Mail::fake();

    $shared = crmInboxShared();
    $tenant = $shared['tenant'];
    $host = $shared['host'];
    $user = $shared['user'];

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create([
        'email' => 'contact-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    $thread = ContactThread::query()->create([
        'contact_id' => $contact->id,
        'subject' => 'Follow up',
        'status' => 'open',
        'reply_token' => 'tok'.uniqid(),
        'created_by_user_id' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->post('http://'.$host.'/communications/inbox/'.$thread->id.'/notes', [
        'body' => 'Called them, no answer.',
    ])->assertRedirect()->assertSessionHas('status', 'note-added');

    tenancy()->initialize($tenant);

    $note = ContactThreadMessage::query()->where('thread_id', $thread->id)->where('direction', 'note')->first();
    expect($note)->not->toBeNull()
        ->and($note->channel)->toBe('note');

    Mail::assertNothingSent();
    tenancy()->end();
});

it('logs an inbound reply via webhook', function (): void {
    $shared = crmInboxShared();
    $tenant = $shared['tenant'];
    $host = $shared['host'];
    $user = $shared['user'];

    $token = 'abc123token'.uniqid();

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create([
        'email' => 'contact-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    $thread = ContactThread::query()->create([
        'contact_id' => $contact->id,
        'subject' => 'Re: property',
        'status' => 'open',
        'reply_token' => $token,
        'created_by_user_id' => $user->id,
    ]);
    tenancy()->end();

    $fromAddress = (string) config('mail.from.address', 'noreply@propreneur.test');
    $domain = str_contains($fromAddress, '@') ? substr($fromAddress, strpos($fromAddress, '@') + 1) : 'propreneur.test';

    $this->post('http://'.$host.'/webhooks/email/inbound', crmInboxMailgunSignedPayload([
        'recipient' => 'replies+'.$token.'@'.$domain,
        'body-plain' => 'Thanks, I am interested.',
        'from' => 'Contact <contact@example.test>',
        'Message-Id' => '<msg-'.uniqid().'@example.test>',
    ]))->assertOk()->assertJson(['status' => 'ok']);

    tenancy()->initialize($tenant);
    $thread->refresh();

    expect(ContactThreadMessage::query()->where('thread_id', $thread->id)->where('direction', 'inbound')->count())->toBe(1)
        ->and($thread->unread_inbound_count)->toBe(1)
        ->and($thread->messages_count)->toBe(1);

    tenancy()->end();
});

it('rejects inbound webhook without a valid signature', function (): void {
    $shared = crmInboxShared();
    $host = $shared['host'];

    $this->post('http://'.$host.'/webhooks/email/inbound', [
        'recipient' => 'replies+invalid@example.com',
        'body-plain' => 'Should not be accepted',
        'timestamp' => (string) time(),
        'token' => 'bad',
        'signature' => 'not-valid',
    ])->assertUnauthorized()->assertJson(['status' => 'unauthorized']);
});

it('deduplicates inbound messages by external_message_id', function (): void {
    $shared = crmInboxShared();
    $tenant = $shared['tenant'];
    $host = $shared['host'];
    $user = $shared['user'];

    $token = 'dedup'.uniqid();
    $messageId = '<dedup-'.uniqid().'@example.test>';

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create([
        'email' => 'contact-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    ContactThread::query()->create([
        'contact_id' => $contact->id,
        'subject' => 'Dedup test',
        'status' => 'open',
        'reply_token' => $token,
        'created_by_user_id' => $user->id,
    ]);
    tenancy()->end();

    $fromAddress = (string) config('mail.from.address', 'noreply@propreneur.test');
    $domain = str_contains($fromAddress, '@') ? substr($fromAddress, strpos($fromAddress, '@') + 1) : 'propreneur.test';

    $payload = crmInboxMailgunSignedPayload([
        'recipient' => 'replies+'.$token.'@'.$domain,
        'body-plain' => 'Same message twice',
        'from' => 'contact@example.test',
        'Message-Id' => $messageId,
    ]);

    $this->post('http://'.$host.'/webhooks/email/inbound', $payload)->assertOk();
    $this->post('http://'.$host.'/webhooks/email/inbound', $payload)->assertOk();

    tenancy()->initialize($tenant);
    expect(ContactThreadMessage::query()->where('direction', 'inbound')->where('external_message_id', $messageId)->count())->toBe(1);
    tenancy()->end();
});

it('marks thread read and clears unread count', function (): void {
    $shared = crmInboxShared();
    $tenant = $shared['tenant'];
    $host = $shared['host'];
    $user = $shared['user'];

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create([
        'email' => 'contact-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    $thread = ContactThread::query()->create([
        'contact_id' => $contact->id,
        'subject' => 'Unread test',
        'status' => 'open',
        'reply_token' => 'read'.uniqid(),
        'created_by_user_id' => $user->id,
        'unread_inbound_count' => 2,
        'messages_count' => 2,
    ]);
    ContactThreadMessage::query()->create([
        'thread_id' => $thread->id,
        'contact_id' => $contact->id,
        'direction' => 'inbound',
        'channel' => 'email',
        'body_text' => 'First',
        'from_email' => 'a@example.test',
    ]);
    ContactThreadMessage::query()->create([
        'thread_id' => $thread->id,
        'contact_id' => $contact->id,
        'direction' => 'inbound',
        'channel' => 'email',
        'body_text' => 'Second',
        'from_email' => 'b@example.test',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/communications/inbox/'.$thread->id)->assertOk();

    tenancy()->initialize($tenant);
    $thread->refresh();
    expect($thread->unread_inbound_count)->toBe(0)
        ->and(ContactThreadMessage::query()->where('thread_id', $thread->id)->where('direction', 'inbound')->whereNull('staff_read_at')->count())->toBe(0);
    tenancy()->end();
});

it('closes and reopens a thread via status route', function (): void {
    $shared = crmInboxShared();
    $tenant = $shared['tenant'];
    $host = $shared['host'];
    $user = $shared['user'];

    tenancy()->initialize($tenant);
    $contact = Contact::factory()->create([
        'email' => 'contact-'.uniqid().'@example.test',
        'created_by' => $user->id,
    ]);
    $thread = ContactThread::query()->create([
        'contact_id' => $contact->id,
        'subject' => 'Status test',
        'status' => 'open',
        'reply_token' => 'status'.uniqid(),
        'created_by_user_id' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->patch('http://'.$host.'/communications/inbox/'.$thread->id.'/status', [
        'status' => 'closed',
    ])->assertRedirect()->assertSessionHas('status', 'thread-updated');

    tenancy()->initialize($tenant);
    expect($thread->fresh()->status)->toBe('closed');
    tenancy()->end();

    $this->patch('http://'.$host.'/communications/inbox/'.$thread->id.'/status', [
        'status' => 'open',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect($thread->fresh()->status)->toBe('open');
    tenancy()->end();
});
