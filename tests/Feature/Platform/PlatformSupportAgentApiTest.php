<?php

declare(strict_types=1);

use App\Enums\PlatformSupportTicketPriority;
use App\Enums\PlatformSupportTicketStatus;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformAgentApiKey;
use App\Models\Central\PlatformSupportTicket;
use App\Models\Central\PlatformUser;
use App\Services\Carina\CarinaService;
use App\Support\PlatformSupport\PlatformSupportAgentAbilities;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'platform_support_tickets')->update(['enabled' => true]);
    FeatureFlag::query()->where('key', 'platform_support_agent_api')->update(['enabled' => true]);
    Mail::fake();
});

function agentApiHeaders(string $plainKey): array
{
    return ['Authorization' => 'Bearer '.$plainKey];
}

it('rejects agent api without a bearer token', function (): void {
    $this->getJson(route('api.platform.support.tickets.index'))
        ->assertUnauthorized();
});

it('lists tickets with a read-only agent key', function (): void {
    $tenant = createCentralTenant();
    PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00901',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'API list',
        'status' => PlatformSupportTicketStatus::Open,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    [$plain] = PlatformAgentApiKey::mint('test-read', [PlatformSupportAgentAbilities::READ]);

    $this->getJson(route('api.platform.support.tickets.index', ['search' => '00901']), agentApiHeaders($plain))
        ->assertOk()
        ->assertJsonPath('count', 1)
        ->assertJsonPath('tickets.0.ticket_number', 'SUP-2026-00901');
});

it('posts a platform reply with a reply ability key', function (): void {
    $admin = PlatformUser::factory()->admin()->create();
    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00902',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'API reply',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    [$plain] = PlatformAgentApiKey::mint('test-reply', [PlatformSupportAgentAbilities::REPLY], $admin->id);

    $this->postJson(
        route('api.platform.support.tickets.reply', ['ticketRef' => $ticket->ticket_number]),
        ['body' => 'We are looking into this now.'],
        agentApiHeaders($plain),
    )
        ->assertOk()
        ->assertJsonPath('sent', true)
        ->assertJsonPath('ticket.status', 'waiting_tenant');

    expect($ticket->fresh()->messages()->where('is_internal', false)->count())->toBe(1);
});

it('returns draft without sending', function (): void {
    $admin = PlatformUser::factory()->admin()->create();
    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00903',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'API draft',
        'status' => PlatformSupportTicketStatus::Open,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('platformComplete')->once()->andReturn('Draft body for the customer.');
    });

    [$plain] = PlatformAgentApiKey::mint('test-draft', [PlatformSupportAgentAbilities::DRAFT], $admin->id);

    $this->postJson(
        route('api.platform.support.tickets.draft-reply', ['ticketRef' => $ticket->ticket_number]),
        [],
        agentApiHeaders($plain),
    )
        ->assertOk()
        ->assertJsonPath('sent', false)
        ->assertJsonPath('draft', 'Draft body for the customer.');

    expect($ticket->messages()->count())->toBe(0);
});

it('denies reply ability without linked platform user', function (): void {
    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00904',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test',
        'requester_email' => 't@example.test',
        'subject' => 'No user',
        'status' => PlatformSupportTicketStatus::Open,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    [$plain] = PlatformAgentApiKey::mint('test-no-user', [PlatformSupportAgentAbilities::REPLY]);

    $this->postJson(
        route('api.platform.support.tickets.reply', ['ticketRef' => $ticket->ticket_number]),
        ['body' => 'Hello'],
        agentApiHeaders($plain),
    )->assertForbidden();
});
