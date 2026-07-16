<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaScheduledRun;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaScheduledAgentService;
use App\Services\Carina\Contracts\CarinaAgentChatRunner;
use App\Services\Tenancy\TenantCreationService;

it('task list returns at least one task', function (): void {
    $service = app(CarinaScheduledAgentService::class);
    $tasks = $service->taskList();

    expect($tasks)->not->toBeEmpty();
    expect($tasks[0])->toHaveKeys(['slug', 'label', 'enabled', 'max_steps', 'prompt']);
});

it('artisan command exits successfully with dry-run flag', function (): void {
    $this->artisan('carina:scheduled-agent --dry-run')
        ->assertExitCode(0);
});

describe('tenant scheduled runs', function (): void {
    beforeEach(function (): void {
        $this->tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Carina Scheduled '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-'.uniqid().'@carina-scheduled.test',
            'plan' => 'starter',
        ]);

        tenancy()->initialize($this->tenant);

        TenantRole::findOrCreate('tenant_admin', 'web');

        $this->user = User::query()->where('email', $this->tenant->owner_email)->firstOrFail();
        $this->user->syncRoles(['tenant_admin']);
    });

    afterEach(function (): void {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
    });

    it('creates a CarinaScheduledRun record when a task runs', function (): void {
        $mockAgent = Mockery::mock(CarinaAgentChatRunner::class);
        $mockAgent->shouldReceive('agentChat')->andReturn([
            'reply' => 'All compliance items are up to date.',
            'steps_used' => 2,
            'requires_confirmation' => false,
            'pending_action' => null,
            'actions' => [],
        ]);

        $service = new CarinaScheduledAgentService($mockAgent);
        $tasks = $service->taskList();
        $task = collect($tasks)->firstWhere('slug', 'compliance-expiry-digest');

        expect($task)->not->toBeNull();

        $service->runTask($task, $this->user);

        $run = CarinaScheduledRun::where('task_slug', 'compliance-expiry-digest')->first();

        expect($run)->not->toBeNull()
            ->and($run->status)->toBe('completed')
            ->and($run->digest_output)->toBe('All compliance items are up to date.')
            ->and($run->tool_steps_used)->toBe(2);
    });

    it('marks run as failed when agent throws', function (): void {
        $mockAgent = Mockery::mock(CarinaAgentChatRunner::class);
        $mockAgent->shouldReceive('agentChat')->andThrow(new RuntimeException('LLM unavailable'));

        $service = new CarinaScheduledAgentService($mockAgent);
        $tasks = $service->taskList();
        $task = collect($tasks)->firstWhere('slug', 'compliance-expiry-digest');

        $service->runTask($task, $this->user);

        $run = CarinaScheduledRun::where('task_slug', 'compliance-expiry-digest')->first();

        expect($run->status)->toBe('failed')
            ->and($run->error_message)->toBe('LLM unavailable');
    });

    it('runAll skips disabled tasks', function (): void {
        $mockAgent = Mockery::mock(CarinaAgentChatRunner::class);
        $mockAgent->shouldReceive('agentChat')->andReturn([
            'reply' => 'Nothing to report.',
            'steps_used' => 1,
            'requires_confirmation' => false,
            'pending_action' => null,
            'actions' => [],
        ]);

        $service = new CarinaScheduledAgentService($mockAgent);
        $service->runAll($this->user);

        $slugs = CarinaScheduledRun::query()->pluck('task_slug')->all();

        expect($slugs)->not->toContain('contact-engagement-review');
    });

    it('artisan command exits successfully for a specific tenant slug', function (): void {
        $this->artisan('carina:scheduled-agent --tenant='.$this->tenant->slug.' --dry-run')
            ->assertExitCode(0);
    });
});

it('artisan command dry-run finds an active tenant by slug when one exists', function (): void {
    $tenant = Tenant::on('central')->where('is_active', true)->first();

    if ($tenant === null) {
        $tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Carina Slug '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-'.uniqid().'@carina-slug.test',
            'plan' => 'starter',
        ]);
    }

    $this->artisan('carina:scheduled-agent --tenant='.$tenant->slug.' --dry-run')
        ->assertExitCode(0);
});
