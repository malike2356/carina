<?php

declare(strict_types=1);

use App\Enums\PlatformSupportTicketPriority;
use App\Enums\PlatformSupportTicketStatus;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSupportTicket;
use App\Models\Central\PlatformUser;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'platform_support_tickets')->update(['enabled' => true]);
    Mail::fake();
});

it('lets a tenant user create a support ticket with a numbered reference', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Support Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@support.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->post('http://'.$host.'/support', [
            'subject' => 'Deal calculator error',
            'body' => 'Numbers do not match after save.',
            'priority' => 'high',
        ])
        ->assertRedirect();

    $ticket = PlatformSupportTicket::query()->first();
    expect($ticket)->not->toBeNull()
        ->and($ticket->ticket_number)->toMatch('/^SUP-\d{4}-\d{5}$/')
        ->and($ticket->tenant_id)->toBe($tenant->id)
        ->and($ticket->status)->toBe(PlatformSupportTicketStatus::WaitingSupport);
});

it('lets platform support staff view the admin inbox', function (): void {
    $support = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_SUPPORT]);

    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00001',
        'tenant_id' => createCentralTenant()->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test User',
        'requester_email' => 'user@example.test',
        'subject' => 'Help',
        'status' => PlatformSupportTicketStatus::Open,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    $this->actingAs($support, 'platform')
        ->get(route('admin.support-tickets.index'))
        ->assertOk()
        ->assertSee($ticket->ticket_number, false);
});

it('lets platform support reply and update ticket status', function (): void {
    $admin = PlatformUser::factory()->admin()->create();
    $tenant = createCentralTenant();

    $ticket = PlatformSupportTicket::query()->create([
        'ticket_number' => 'SUP-2026-00002',
        'tenant_id' => $tenant->id,
        'tenant_user_id' => 1,
        'requester_name' => 'Test User',
        'requester_email' => 'user@example.test',
        'subject' => 'Billing question',
        'status' => PlatformSupportTicketStatus::WaitingSupport,
        'priority' => PlatformSupportTicketPriority::Normal,
        'last_activity_at' => now(),
    ]);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.support-tickets.reply', $ticket), [
            'body' => 'We have applied a credit to your account.',
            'status' => PlatformSupportTicketStatus::WaitingTenant->value,
        ])
        ->assertRedirect();

    $ticket->refresh();
    expect($ticket->status)->toBe(PlatformSupportTicketStatus::WaitingTenant)
        ->and($ticket->messages()->where('is_internal', false)->count())->toBe(1);
});
