<?php

declare(strict_types=1);

use App\Jobs\Carina\CarinaCompileSkillsJob;
use App\Services\Carina\Remote\CarinaHubPushService;
use App\Services\Tenancy\TenantCreationService;
use App\Models\Tenant\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

it('pushes reply to hub webhook with shared key header', function (): void {
    config([
        'services.carina_hub.reply_url' => 'https://carinaai.test/api/webhooks/propreneur-reply',
        'services.carina_hub.webhook_secret' => 'push-secret',
    ]);

    Http::fake([
        'https://carinaai.test/api/webhooks/propreneur-reply' => Http::response(['ok' => true], 200),
    ]);

    app(CarinaHubPushService::class)->pushReply('sess_123', 'Hello from Propreneur', false);

    Http::assertSent(function ($request) {
        return $request->url() === 'https://carinaai.test/api/webhooks/propreneur-reply'
            && $request->hasHeader('X-Carina-Hub-Key', 'push-secret')
            && $request['session_id'] === 'sess_123'
            && $request['reply'] === 'Hello from Propreneur';
    });
});

it('hub push is a no-op when url or secret missing', function (): void {
    config([
        'services.carina_hub.reply_url' => '',
        'services.carina_hub.webhook_secret' => '',
    ]);

    Http::fake();

    app(CarinaHubPushService::class)->pushReply('sess_123', 'ignored');

    Http::assertNothingSent();
});

it('workspace admin can queue hub skills sync from settings', function (): void {
    Queue::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Hub Sync '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hub-sync.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->post('http://'.$host.'/settings/carina-remote/skills-hub/sync')
        ->assertRedirect()
        ->assertSessionHas('success', 'Skills syncing in background. Refresh in 30 seconds.');

    Queue::assertPushed(CarinaCompileSkillsJob::class);
});

it('skills hub settings page shows subscribed packs and catalogue', function (): void {
    Http::fake([
        'https://hub.carinaai.uk/api/packs' => Http::response([
            'packs' => [[
                'name' => 'propreneur-workspace',
                'description' => 'Property portfolio via Propreneur',
                'skill_count' => 5,
                'category' => 'property',
            ]],
        ], 200),
    ]);

    config(['carina.hub.packs' => 'propreneur-workspace,legal-uk']);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Hub UI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@hub-ui.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->get('http://'.$host.'/settings/carina-remote')
        ->assertOk()
        ->assertSee('Skills Hub')
        ->assertSee('propreneur-workspace')
        ->assertSee('Property portfolio via Propreneur')
        ->assertSee('Sync Hub Skills');
});
