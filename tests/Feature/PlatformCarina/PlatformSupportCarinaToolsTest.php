<?php

declare(strict_types=1);

use App\Enums\PlatformSupportMessageAuthorType;
use App\Enums\PlatformSupportTicketPriority;
use App\Enums\PlatformSupportTicketStatus;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformCarinaConversation;
use App\Models\Central\PlatformSupportMessage;
use App\Models\Central\PlatformSupportTicket;
use App\Models\Central\PlatformUser;
use App\Services\Carina\CarinaService;
use App\Services\Carina\PlatformCarinaToolRegistry;
use App\Services\Carina\PlatformTools\PlatformDraftSupportReplyTool;
use App\Services\Carina\PlatformTools\PlatformGetSupportTicketTool;
use App\Services\Carina\PlatformTools\PlatformListSupportTicketsTool;
use App\Services\Carina\Tools\ToolResult;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'platform_support_tickets')->update(['enabled' => true]);
});

it('lists support tickets for platform support staff', function (): void {
    $tenant = createCentralTenant();
    PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00099',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Alex',
        'requester_email' => 'alex@example.test',
        'subject' => 'Billing question',
        'status' => PlatformSupportTicketStatus::Open,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    $support = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_SUPPORT]);
    $conversation = PlatformCarinaConversation::query()->create([
        'platform_user_id' => $support->id,
        'title' => 'Test',
    ]);

    $tool = app(PlatformListSupportTicketsTool::class);
    $result = $tool->execute(['search' => '00099'], $support, $conversation);

    expect($result->success)->toBeTrue();
    $numbers = collect($result->data['tickets'] ?? [])->pluck('ticket_number')->all();
    expect($numbers)->toContain('SUP-2026-00099');
});

it('gets support ticket thread including internal notes', function (): void {
    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00100',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Sam',
        'requester_email' => 'sam@example.test',
        'subject' => 'Login issue',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::High,
        'last_activity_at' => now(),
    ]);

    PlatformSupportMessage::query()->create([
        'platform_support_ticket_id' => $ticket->id,
        'author_type' => PlatformSupportMessageAuthorType::TenantUser,
        'author_name' => 'Sam',
        'body' => 'Cannot log in after password reset.',
        'is_internal' => false,
    ]);
    PlatformSupportMessage::query()->create([
        'platform_support_ticket_id' => $ticket->id,
        'author_type' => PlatformSupportMessageAuthorType::PlatformUser,
        'author_name' => 'Support',
        'body' => 'Check spam folder for reset email.',
        'is_internal' => true,
    ]);

    $admin = PlatformUser::factory()->admin()->create();
    $conversation = PlatformCarinaConversation::query()->create([
        'platform_user_id' => $admin->id,
        'title' => 'Test',
    ]);

    $tool = app(PlatformGetSupportTicketTool::class);
    $result = $tool->execute(['ticket_number' => 'SUP-2026-00100'], $admin, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['ticket']['ticket_number'] ?? null)->toBe('SUP-2026-00100')
        ->and($result->data['thread'] ?? '')->toContain('INTERNAL')
        ->and($result->data['thread'] ?? '')->toContain('Cannot log in');
});

it('drafts a support reply without sending', function (): void {
    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00101',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Jo',
        'requester_email' => 'jo@example.test',
        'subject' => 'Export failed',
        'status' => PlatformSupportTicketStatus::Open,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    PlatformSupportMessage::query()->create([
        'platform_support_ticket_id' => $ticket->id,
        'author_type' => PlatformSupportMessageAuthorType::TenantUser,
        'author_name' => 'Jo',
        'body' => 'CSV export times out.',
        'is_internal' => false,
    ]);

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('platformComplete')
            ->once()
            ->andReturn('Thank you for your patience. We are investigating the export timeout.');
    });

    $admin = PlatformUser::factory()->admin()->create();
    $conversation = PlatformCarinaConversation::query()->create([
        'platform_user_id' => $admin->id,
        'title' => 'Test',
    ]);

    $tool = app(PlatformDraftSupportReplyTool::class);
    $result = $tool->execute(['ticket_number' => 'SUP-2026-00101'], $admin, $conversation);

    expect($result)->toBeInstanceOf(ToolResult::class);
    expect($result->success)->toBeTrue()
        ->and($result->data['sent'] ?? null)->toBeFalse()
        ->and($result->data['draft'] ?? '')->toContain('export timeout');
});

it('denies support carina tools without manage-platform-support', function (): void {
    $viewer = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_ADMIN]);
    $viewer->syncRoles([]);
    $viewer->givePermissionTo('view-saas-tenants');

    $tool = app(PlatformListSupportTicketsTool::class);
    expect($tool->authorize($viewer))->toBeFalse();
});

it('registers thirteen platform carina tools', function (): void {
    expect(count(app(PlatformCarinaToolRegistry::class)->all()))->toBe(13);
});

it('redirects ask carina from support ticket to a seeded conversation', function (): void {
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);

    $admin = PlatformUser::factory()->admin()->create();
    $tenant = createCentralTenant();
    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00102',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Pat',
        'requester_email' => 'pat@example.test',
        'subject' => 'Need help',
        'status' => PlatformSupportTicketStatus::Open,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.support-tickets.carina', $ticket))
        ->assertRedirect()
        ->assertSessionHas('carina_seed_message');

    $conversation = PlatformCarinaConversation::query()->latest('id')->first();
    expect($conversation)->not->toBeNull()
        ->and($conversation->title)->toBe('Support: SUP-2026-00102');
});
