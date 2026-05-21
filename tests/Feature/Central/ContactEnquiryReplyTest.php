<?php

declare(strict_types=1);

use App\Mail\Central\ContactEnquiryReplyMail;
use App\Models\Central\ContactEnquiry;
use App\Models\Central\ContactEnquiryMessage;
use App\Models\Central\PlatformUser;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);

    config([
        'services.inbound_email_webhook.mailgun_signing_key' => 'test-mailgun-signing-key',
        'services.inbound_email_webhook.postmark_server_token' => '',
        'services.inbound_email_webhook.shared_secret' => '',
        'services.inbound_email_webhook.require_signature' => true,
        'mail.from.address' => 'noreply@propreneur.test',
    ]);
});

/**
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function enquiryInboundMailgunPayload(array $fields): array
{
    $timestamp = (string) time();
    $token = 'webhook-token-'.uniqid();

    return array_merge($fields, [
        'timestamp' => $timestamp,
        'token' => $token,
        'signature' => hash_hmac('sha256', $timestamp.$token, 'test-mailgun-signing-key'),
    ]);
}

it('sends enquiry reply synchronously to the contact email', function (): void {
    Mail::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $enquiry = ContactEnquiry::query()->create([
        'contact_name' => 'Laud Gablah',
        'contact_email' => 'contact@example.com',
        'message' => 'I need Enterprise White-label for my business',
    ]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.enquiries.reply', $enquiry), [
            'reply_from_name' => 'Laud Paul',
            'reply_body' => 'Thanks for reaching out — we will follow up shortly.',
        ])
        ->assertRedirect(route('admin.enquiries.show', $enquiry))
        ->assertSessionHas('status');

    $enquiry->refresh();
    expect($enquiry->reply_body)->toBe('Thanks for reaching out — we will follow up shortly.')
        ->and($enquiry->reply_from_name)->toBe('Laud Paul')
        ->and($enquiry->replied_at)->not->toBeNull()
        ->and($enquiry->reply_token)->not->toBeEmpty();

    expect(ContactEnquiryMessage::query()->where('enquiry_id', $enquiry->id)->where('direction', 'outbound')->count())->toBe(1);

    Mail::assertSent(ContactEnquiryReplyMail::class, function (ContactEnquiryReplyMail $mail) use ($enquiry): bool {
        return $mail->hasTo($enquiry->contact_email)
            && $mail->enquiry->is($enquiry);
    });

    Mail::assertNotQueued(ContactEnquiryReplyMail::class);
});

it('shows an error when the mail transport throws', function (): void {
    Mail::shouldReceive('to')
        ->once()
        ->andReturnSelf();
    Mail::shouldReceive('send')
        ->once()
        ->andThrow(new RuntimeException('Resend domain not verified'));

    $admin = PlatformUser::factory()->superAdmin()->create();
    $enquiry = ContactEnquiry::query()->create([
        'contact_name' => 'Laud Gablah',
        'contact_email' => 'contact@example.com',
        'message' => 'Hello',
    ]);

    $this->actingAs($admin, 'platform')
        ->from(route('admin.enquiries.show', $enquiry))
        ->post(route('admin.enquiries.reply', $enquiry), [
            'reply_from_name' => 'Laud Paul',
            'reply_body' => 'This should fail at send time.',
        ])
        ->assertRedirect(route('admin.enquiries.show', $enquiry))
        ->assertSessionHas('error');
});

it('logs an inbound email reply via the platform webhook', function (): void {
    $enquiry = ContactEnquiry::query()->create([
        'contact_name' => 'Laud Gablah',
        'contact_email' => 'lordsesame@gmail.com',
        'message' => 'I need Enterprise White-label for my business',
        'reply_token' => 'inboundtok'.uniqid(),
        'read_at' => now(),
    ]);

    $recipient = 'enquiries+'.$enquiry->reply_token.'@propreneur.test';

    $this->post(route('webhooks.platform.email.inbound'), enquiryInboundMailgunPayload([
        'recipient' => $recipient,
        'body-plain' => 'How long ago',
        'from' => 'Laud Paul <lordsesame@gmail.com>',
        'Message-Id' => '<inbound-'.uniqid().'@gmail.com>',
    ]))->assertOk()->assertJson(['status' => 'ok']);

    $enquiry->refresh();

    expect(ContactEnquiryMessage::query()->where('enquiry_id', $enquiry->id)->where('direction', 'inbound')->count())->toBe(1)
        ->and($enquiry->read_at)->toBeNull();

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.enquiries.show', $enquiry))
        ->assertOk()
        ->assertSee('How long ago', false)
        ->assertSee('Inbound from', false);
});
