<?php

declare(strict_types=1);

use App\Services\Crm\InboundEmailWebhookVerifier;
use Illuminate\Http\Request;

beforeEach(function (): void {
    config([
        'services.inbound_email_webhook.mailgun_signing_key' => 'test-mailgun-signing-key',
        'services.inbound_email_webhook.postmark_server_token' => '',
        'services.inbound_email_webhook.shared_secret' => '',
        'services.inbound_email_webhook.require_signature' => true,
        'services.inbound_email_webhook.max_timestamp_skew_seconds' => 900,
    ]);
});

/**
 * @param  array<string, mixed>  $fields
 * @return array<string, mixed>
 */
function mailgunSignedWebhookFields(array $fields, string $signingKey = 'test-mailgun-signing-key'): array
{
    $timestamp = (string) time();
    $token = 'webhook-token-'.uniqid();

    return array_merge($fields, [
        'timestamp' => $timestamp,
        'token' => $token,
        'signature' => hash_hmac('sha256', $timestamp.$token, $signingKey),
    ]);
}

it('accepts a valid Mailgun signature', function (): void {
    $verifier = app(InboundEmailWebhookVerifier::class);
    $request = Request::create('/webhooks/email/inbound', 'POST', mailgunSignedWebhookFields([
        'recipient' => 'replies+abc@example.com',
    ]));

    expect($verifier->verify($request))->toBeTrue();
});

it('rejects an invalid Mailgun signature', function (): void {
    $verifier = app(InboundEmailWebhookVerifier::class);
    $request = Request::create('/webhooks/email/inbound', 'POST', [
        'timestamp' => (string) time(),
        'token' => 'bad',
        'signature' => 'invalid',
        'recipient' => 'replies+abc@example.com',
    ]);

    expect($verifier->verify($request))->toBeFalse();
});

it('rejects stale Mailgun timestamps', function (): void {
    $verifier = app(InboundEmailWebhookVerifier::class);
    $timestamp = (string) (time() - 3600);
    $token = 'stale-token';
    $request = Request::create('/webhooks/email/inbound', 'POST', [
        'timestamp' => $timestamp,
        'token' => $token,
        'signature' => hash_hmac('sha256', $timestamp.$token, 'test-mailgun-signing-key'),
        'recipient' => 'replies+abc@example.com',
    ]);

    expect($verifier->verify($request))->toBeFalse();
});

it('accepts Postmark X-Postmark-Signature when configured', function (): void {
    config([
        'services.inbound_email_webhook.mailgun_signing_key' => '',
        'services.inbound_email_webhook.postmark_server_token' => 'postmark-server-token',
    ]);

    $body = 'recipient=replies%2Babc%40example.com&TextBody=Hello';
    $signature = base64_encode(hash_hmac('sha256', $body, 'postmark-server-token', true));

    $verifier = app(InboundEmailWebhookVerifier::class);
    $request = Request::create(
        '/webhooks/email/inbound',
        'POST',
        [],
        [],
        [],
        ['HTTP_X-Postmark-Signature' => $signature, 'CONTENT_TYPE' => 'application/x-www-form-urlencoded'],
        $body,
    );

    expect($verifier->verify($request))->toBeTrue();
});

it('skips verification when no credentials are configured in non-production', function (): void {
    config([
        'services.inbound_email_webhook.mailgun_signing_key' => '',
        'services.inbound_email_webhook.postmark_server_token' => '',
        'services.inbound_email_webhook.shared_secret' => '',
        'services.inbound_email_webhook.require_signature' => null,
    ]);

    $verifier = app(InboundEmailWebhookVerifier::class);
    $request = Request::create('/webhooks/email/inbound', 'POST', [
        'recipient' => 'replies+abc@example.com',
    ]);

    expect($verifier->isVerificationRequired())->toBeFalse()
        ->and($verifier->verify($request))->toBeTrue();
});
