<?php

declare(strict_types=1);

use App\Enums\PlatformSupportMessageAuthorType;
use App\Enums\PlatformSupportTicketPriority;
use App\Enums\PlatformSupportTicketStatus;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSupportMessage;
use App\Models\Central\PlatformSupportTicket;
use App\Models\Tenant\User;
use App\Services\PlatformSupport\PlatformSupportSlackNotifier;
use App\Services\PlatformSupport\PlatformSupportTicketService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
});

it('does not post to slack when platform_support_slack_notify is off', function (): void {
    Http::fake();
    FeatureFlag::query()->where('key', 'platform_support_slack_notify')->update(['enabled' => false]);
    config(['platform_support.slack_webhook_url' => 'https://hooks.slack.com/services/fake/fake/fake']);

    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00099',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'Help',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    app(PlatformSupportSlackNotifier::class)->notifyNewTicket($ticket);

    Http::assertNothingSent();
});

it('does not post to slack when webhook url is empty', function (): void {
    Http::fake();
    FeatureFlag::query()->where('key', 'platform_support_slack_notify')->update(['enabled' => true]);
    config(['platform_support.slack_webhook_url' => '']);

    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00098',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'Help',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    app(PlatformSupportSlackNotifier::class)->notifyNewTicket($ticket);

    Http::assertNothingSent();
});

it('posts new ticket summary to slack when flag and webhook are set', function (): void {
    FeatureFlag::query()->where('key', 'platform_support_slack_notify')->update(['enabled' => true]);
    $webhook = 'https://hooks.slack.com/services/SUPPORT/WEB/HOOK';
    config(['platform_support.slack_webhook_url' => $webhook]);

    Http::fake([$webhook => Http::response('ok', 200)]);

    $tenant = createCentralTenant(['company_name' => 'Acme Workspace']);
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00042',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Laud',
        'requester_email' => 'laud@example.test',
        'subject' => 'Calculator bug',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::High,
        'last_activity_at' => now(),
    ]);

    PlatformSupportMessage::query()->create([
        'platform_support_ticket_id' => $ticket->id,
        'author_type' => PlatformSupportMessageAuthorType::TenantUser,
        'author_name' => 'Laud',
        'body' => 'Numbers are wrong after save.',
        'is_internal' => false,
    ]);

    app(PlatformSupportSlackNotifier::class)->notifyNewTicket($ticket);

    Http::assertSent(function ($request) use ($webhook): bool {
        if ($request->url() !== $webhook) {
            return false;
        }
        $text = (string) ($request->data()['text'] ?? '');

        return str_contains($text, 'SUP-2026-00042')
            && str_contains($text, 'Calculator bug')
            && str_contains($text, 'Acme Workspace');
    });
});

it('posts customer reply to slack', function (): void {
    FeatureFlag::query()->where('key', 'platform_support_slack_notify')->update(['enabled' => true]);
    $webhook = 'https://hooks.slack.com/services/SUPPORT/REPLY/HOOK';
    config(['platform_support.slack_webhook_url' => $webhook]);

    Http::fake([$webhook => Http::response('ok', 200)]);

    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00043',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Laud',
        'requester_email' => 'laud@example.test',
        'subject' => 'Still broken',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    $message = PlatformSupportMessage::query()->create([
        'platform_support_ticket_id' => $ticket->id,
        'author_type' => PlatformSupportMessageAuthorType::TenantUser,
        'author_name' => 'Laud',
        'body' => 'Any update on this?',
        'is_internal' => false,
    ]);

    app(PlatformSupportSlackNotifier::class)->notifyCustomerReply($ticket, $message);

    Http::assertSent(function ($request) use ($webhook): bool {
        if ($request->url() !== $webhook) {
            return false;
        }
        $text = (string) ($request->data()['text'] ?? '');

        return str_contains($text, 'Customer reply')
            && str_contains($text, 'SUP-2026-00043')
            && str_contains($text, 'Any update');
    });
});

it('notifies slack when a tenant creates a ticket via the service', function (): void {
    FeatureFlag::query()->where('key', 'platform_support_slack_notify')->update(['enabled' => true]);
    $webhook = 'https://hooks.slack.com/services/SUPPORT/E2E/HOOK';
    config(['platform_support.slack_webhook_url' => $webhook]);
    Http::fake([$webhook => Http::response('ok', 200)]);

    $tenant = createCentralTenant();
    $user = new User([
        'name' => 'Owner',
        'email' => 'owner@example.test',
    ]);
    $user->id = 1;

    app(PlatformSupportTicketService::class)->createFromTenant(
        $tenant,
        $user,
        'Slack integration test',
        'Please confirm Slack received this.',
    );

    Http::assertSent(fn ($request) => $request->url() === $webhook);
});
