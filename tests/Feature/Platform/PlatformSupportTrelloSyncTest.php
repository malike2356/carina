<?php

declare(strict_types=1);

use App\Enums\PlatformSupportMessageAuthorType;
use App\Enums\PlatformSupportTicketPriority;
use App\Enums\PlatformSupportTicketStatus;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use App\Models\Central\PlatformSupportMessage;
use App\Models\Central\PlatformSupportTicket;
use App\Models\Central\PlatformUser;
use App\Services\PlatformSupport\PlatformSupportTrelloService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();

    config([
        'platform_support.trello.api_key' => 'test-key',
        'platform_support.trello.token' => 'test-token',
        'platform_support.trello.board_id' => 'board123',
        'platform_support.trello.list_inbox_id' => 'list-inbox',
        'platform_support.trello.list_done_id' => 'list-done',
    ]);
});

it('does not call trello when feature flag is off', function (): void {
    Http::fake();
    FeatureFlag::query()->where('key', 'platform_support_trello_sync')->update(['enabled' => false]);

    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00100',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'Help',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    app(PlatformSupportTrelloService::class)->createCardForTicket($ticket);

    Http::assertNothingSent();
    expect($ticket->fresh()->trello_card_id)->toBeNull();
});

it('creates a trello card and stores ids on the ticket', function (): void {
    FeatureFlag::query()->where('key', 'platform_support_trello_sync')->update(['enabled' => true]);

    Http::fake([
        'https://api.trello.com/1/cards*' => Http::response([
            'id' => 'cardabc123',
            'shortLink' => 'Hs7DsBob',
        ], 200),
    ]);

    $tenant = createCentralTenant(['company_name' => 'Trello Test Ltd']);
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00101',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Laud',
        'requester_email' => 'laud@example.test',
        'subject' => 'Sync me',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    PlatformSupportMessage::query()->create([
        'platform_support_ticket_id' => $ticket->id,
        'author_type' => PlatformSupportMessageAuthorType::TenantUser,
        'author_name' => 'Laud',
        'body' => 'Initial issue text.',
        'is_internal' => false,
    ]);

    app(PlatformSupportTrelloService::class)->createCardForTicket($ticket);

    $ticket->refresh();
    expect($ticket->trello_card_id)->toBe('cardabc123')
        ->and($ticket->trello_short_link)->toBe('Hs7DsBob')
        ->and(app(PlatformSupportTrelloService::class)->cardUrl($ticket))->toBe('https://trello.com/c/Hs7DsBob');

    Http::assertSent(function ($request): bool {
        return str_starts_with($request->url(), 'https://api.trello.com/1/cards')
            && $request['idList'] === 'list-inbox'
            && str_contains((string) $request['name'], 'SUP-2026-00101');
    });
});

it('moves trello card to done list when ticket is resolved', function (): void {
    FeatureFlag::query()->where('key', 'platform_support_trello_sync')->update(['enabled' => true]);

    Http::fake([
        'https://api.trello.com/1/cards/*' => Http::response([], 200),
    ]);

    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00102',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'Done ticket',
        'status' => PlatformSupportTicketStatus::Resolved,
        'priority' => PlatformSupportTicketPriority::Normal,
        'trello_card_id' => 'card-done-test',
        'last_activity_at' => now(),
    ]);

    app(PlatformSupportTrelloService::class)->syncTicketStatus($ticket);

    Http::assertSent(function ($request): bool {
        return str_contains($request->url(), 'card-done-test')
            && $request->method() === 'PUT'
            && ($request['idList'] ?? null) === 'list-done';
    });
});

it('posts a comment when customer replies', function (): void {
    FeatureFlag::query()->where('key', 'platform_support_trello_sync')->update(['enabled' => true]);

    Http::fake([
        'https://api.trello.com/1/cards/*/actions/comments*' => Http::response(['id' => 'action1'], 200),
    ]);

    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00103',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Laud',
        'requester_email' => 'laud@example.test',
        'subject' => 'Follow up',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'trello_card_id' => 'card-comment',
        'last_activity_at' => now(),
    ]);

    $message = PlatformSupportMessage::query()->create([
        'platform_support_ticket_id' => $ticket->id,
        'author_type' => PlatformSupportMessageAuthorType::TenantUser,
        'author_name' => 'Laud',
        'body' => 'Still waiting for help.',
        'is_internal' => false,
    ]);

    app(PlatformSupportTrelloService::class)->addCustomerReplyComment($ticket, $message);

    Http::assertSent(function ($request): bool {
        return str_contains($request->url(), '/actions/comments')
            && str_contains((string) ($request['text'] ?? ''), 'Still waiting');
    });
});

it('lets super admin save trello board and list ids', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->withoutMiddleware(VerifyCsrfToken::class)
        ->actingAs($admin, 'platform')
        ->put(route('admin.support-tickets.trello-settings.update'), [
            'board_id' => 'my-board',
            'list_inbox_id' => 'my-inbox',
            'list_done_id' => 'my-done',
        ])
        ->assertRedirect();

    expect(PlatformSetting::get('platform_support.trello_board_id'))->toBe('my-board')
        ->and(PlatformSetting::get('platform_support.trello_list_inbox_id'))->toBe('my-inbox');
});
