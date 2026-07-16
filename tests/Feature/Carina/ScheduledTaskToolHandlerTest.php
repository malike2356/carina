<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaScheduledTask;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaCronScheduleParser;
use App\Services\Carina\CarinaCustomScheduledTaskRunner;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\CarinaScheduledAgentDelivery;
use App\Services\Carina\Contracts\CarinaAgentChatRunner;
use App\Services\Notifications\InAppNotificationService;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

/**
 * @return array{0: Tenant, 1: User, 2: CarinaConversation}
 */
function scheduledTaskTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Scheduled Tasks '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@scheduled-tasks.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Scheduled task thread',
    ]);

    tenancy()->end();

    return [$tenant, $user, $conversation];
}

it('creates a task from natural language schedule', function (): void {
    [$tenant, $user, $conversation] = scheduledTaskTenant();
    tenancy()->initialize($tenant);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'create_scheduled_task',
        [
            'name' => 'Weekly portfolio summary',
            'schedule' => 'every Monday at 8am',
            'prompt' => 'Give me a summary of my portfolio this week.',
            'delivery_channel' => 'web',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['created'] ?? null)->toBeTrue()
        ->and($result->data['task']['cron_expression'] ?? null)->toBe('0 8 * * 1')
        ->and($result->data['task']['next_run_at'] ?? null)->not->toBeNull();

    tenancy()->end();
});

it('creates a task from cron expression', function (): void {
    [$tenant, $user, $conversation] = scheduledTaskTenant();
    tenancy()->initialize($tenant);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'create_scheduled_task',
        [
            'name' => 'Monthly arrears check',
            'schedule' => '0 9 25 * *',
            'prompt' => 'List any rent arrears over 7 days.',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['task']['cron_expression'] ?? null)->toBe('0 9 25 * *');

    tenancy()->end();
});

it('lists all active tasks for the user', function (): void {
    [$tenant, $user, $conversation] = scheduledTaskTenant();
    tenancy()->initialize($tenant);

    CarinaScheduledTask::query()->create([
        'user_id' => $user->id,
        'name' => 'Daily check',
        'cron_expression' => '0 9 * * *',
        'prompt' => 'Daily summary',
        'delivery_channel' => 'web',
        'is_active' => true,
        'next_run_at' => now()->addDay(),
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'list_scheduled_tasks',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['tasks'] ?? null)->toHaveCount(1);

    tenancy()->end();
});

it('deletes a task that belongs to the user', function (): void {
    [$tenant, $user, $conversation] = scheduledTaskTenant();
    tenancy()->initialize($tenant);

    $task = CarinaScheduledTask::query()->create([
        'user_id' => $user->id,
        'name' => 'Remove me',
        'cron_expression' => '0 9 * * *',
        'prompt' => 'Test',
        'delivery_channel' => 'web',
        'is_active' => true,
        'next_run_at' => now()->addDay(),
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'delete_scheduled_task',
        ['task_id' => $task->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and(CarinaScheduledTask::query()->whereKey($task->id)->exists())->toBeFalse();

    tenancy()->end();
});

it('cannot delete a task that belongs to a different user', function (): void {
    [$tenant, $user, $conversation] = scheduledTaskTenant();
    tenancy()->initialize($tenant);

    TenantRole::findOrCreate('staff', 'web');
    $other = UserFactory::new()->createOne([
        'email' => 'staff-'.uniqid().'@scheduled-tasks.test',
        'password' => bcrypt('secret-secret-secret'),
    ]);
    $other->syncRoles(['staff']);

    $task = CarinaScheduledTask::query()->create([
        'user_id' => $other->id,
        'name' => 'Other user task',
        'cron_expression' => '0 9 * * *',
        'prompt' => 'Private',
        'delivery_channel' => 'web',
        'is_active' => true,
        'next_run_at' => now()->addDay(),
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'delete_scheduled_task',
        ['task_id' => $task->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse()
        ->and(CarinaScheduledTask::query()->whereKey($task->id)->exists())->toBeTrue();

    tenancy()->end();
});

it('RunCustomTasksCommand dispatches tasks whose next_run_at has passed', function (): void {
    [$tenant, $user] = scheduledTaskTenant();
    tenancy()->initialize($tenant);

    $task = CarinaScheduledTask::query()->create([
        'user_id' => $user->id,
        'name' => 'Due now',
        'cron_expression' => '0 9 * * *',
        'prompt' => 'Run portfolio summary.',
        'delivery_channel' => 'web',
        'is_active' => true,
        'next_run_at' => now()->subMinute(),
    ]);

    $mockAgent = Mockery::mock(CarinaAgentChatRunner::class);
    $mockAgent->shouldReceive('agentChat')->once()->andReturn([
        'reply' => 'Portfolio summary complete.',
        'steps_used' => 1,
        'requires_confirmation' => false,
        'pending_action' => null,
        'actions' => [],
    ]);

    $runner = new CarinaCustomScheduledTaskRunner(
        $mockAgent,
        app(InAppNotificationService::class),
        app(CarinaScheduledAgentDelivery::class),
    );

    expect($runner->runDueTasks())->toBe(1);

    $task->refresh();
    expect($task->last_run_at)->not->toBeNull()
        ->and($task->next_run_at)->not->toBeNull()
        ->and($task->next_run_at->isFuture())->toBeTrue();

    tenancy()->end();
});

it('RunCustomTasksCommand skips tasks not yet due', function (): void {
    [$tenant, $user] = scheduledTaskTenant();
    tenancy()->initialize($tenant);

    CarinaScheduledTask::query()->create([
        'user_id' => $user->id,
        'name' => 'Future task',
        'cron_expression' => '0 9 * * *',
        'prompt' => 'Later.',
        'delivery_channel' => 'web',
        'is_active' => true,
        'next_run_at' => now()->addHour(),
    ]);

    $mockAgent = Mockery::mock(CarinaAgentChatRunner::class);
    $mockAgent->shouldNotReceive('agentChat');

    $runner = new CarinaCustomScheduledTaskRunner(
        $mockAgent,
        app(InAppNotificationService::class),
        app(CarinaScheduledAgentDelivery::class),
    );

    expect($runner->runDueTasks())->toBe(0);

    tenancy()->end();
});

it('parses common natural language schedules', function (): void {
    $parser = app(CarinaCronScheduleParser::class);

    expect($parser->parse('every Monday at 8am'))->toBe('0 8 * * 1')
        ->and($parser->parse('daily at 9am'))->toBe('0 9 * * *')
        ->and($parser->parse('25th of each month'))->toBe('0 9 25 * *')
        ->and($parser->parse('0 8 * * 1'))->toBe('0 8 * * 1');
});
