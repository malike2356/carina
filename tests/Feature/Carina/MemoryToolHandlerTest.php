<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\CarinaMemory;
use App\Models\Tenant\EpisodicMessage;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaBaselineContextService;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

/**
 * @return array{0: Tenant, 1: User, 2: CarinaConversation}
 */
function memoryToolTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Memory Tools '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@memory-tools.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Memory thread',
    ]);

    tenancy()->end();

    return [$tenant, $user, $conversation];
}

it('stores a memory fact via remember tool', function (): void {
    [$tenant, $user, $conversation] = memoryToolTenant();
    tenancy()->initialize($tenant);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'remember',
        ['key' => 'investment-strategy', 'value' => 'HMO focus, 6-bed, Portsmouth'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['stored'] ?? null)->toBeTrue()
        ->and($result->data['key'] ?? null)->toBe('investment-strategy');

    expect(CarinaMemory::query()->where('user_id', $user->id)->count())->toBe(1);

    tenancy()->end();
});

it('overwrites existing key on remember', function (): void {
    [$tenant, $user, $conversation] = memoryToolTenant();
    tenancy()->initialize($tenant);

    $dispatcher = app(CarinaModuleToolDispatcher::class);
    $dispatcher->dispatch(
        'remember',
        ['key' => 'target-yield', 'value' => '10% gross'],
        $user,
        $conversation,
    );
    $dispatcher->dispatch(
        'remember',
        ['key' => 'target-yield', 'value' => '12% gross minimum'],
        $user,
        $conversation,
    );

    $row = CarinaMemory::query()->where('user_id', $user->id)->where('key', 'target-yield')->first();

    expect(CarinaMemory::query()->where('user_id', $user->id)->count())->toBe(1)
        ->and($row?->value)->toBe('12% gross minimum');

    tenancy()->end();
});

it('returns all memories via recall', function (): void {
    [$tenant, $user, $conversation] = memoryToolTenant();
    tenancy()->initialize($tenant);

    CarinaMemory::query()->create([
        'user_id' => $user->id,
        'key' => 'investment-strategy',
        'value' => 'HMO focus, 6-bed, Portsmouth',
    ]);
    CarinaMemory::query()->create([
        'user_id' => $user->id,
        'key' => 'target-yield',
        'value' => '12% gross minimum',
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'recall',
        ['query' => 'what is my investment strategy?'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['memories'] ?? null)->toHaveCount(2)
        ->and(collect($result->data['memories'])->pluck('key')->all())->toContain('investment-strategy', 'target-yield');

    tenancy()->end();
});

it('keyword-searches episodic messages via recall', function (): void {
    [$tenant, $user, $conversation] = memoryToolTenant();
    tenancy()->initialize($tenant);

    EpisodicMessage::query()->create([
        'user_id' => $user->id,
        'conversation_id' => $conversation->id,
        'role' => 'user',
        'content' => 'My target yield for Portsmouth HMO deals is 12% gross.',
        'recorded_at' => now()->subDay(),
    ]);
    EpisodicMessage::query()->create([
        'user_id' => $user->id,
        'conversation_id' => $conversation->id,
        'role' => 'assistant',
        'content' => 'Noted. I will prioritise Portsmouth HMO opportunities at 12% gross or better.',
        'recorded_at' => now()->subDay()->addMinute(),
    ]);
    EpisodicMessage::query()->create([
        'user_id' => $user->id,
        'conversation_id' => $conversation->id,
        'role' => 'user',
        'content' => 'Unrelated note about Manchester BTL flats.',
        'recorded_at' => now()->subDays(2),
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'recall',
        ['query' => 'Portsmouth yield'],
        $user,
        $conversation,
    );

    $matches = collect($result->data['episodic_matches'] ?? []);

    expect($result->success)->toBeTrue()
        ->and($matches)->not->toBeEmpty()
        ->and($matches->first(fn (array $row): bool => str_contains((string) ($row['content'] ?? ''), 'Portsmouth')))->not->toBeNull();

    tenancy()->end();
});

it('memory block is injected into baseline context when memories exist', function (): void {
    [$tenant, $user] = memoryToolTenant();
    tenancy()->initialize($tenant);

    CarinaMemory::query()->create([
        'user_id' => $user->id,
        'key' => 'investment-strategy',
        'value' => 'HMO focus, 6-bed, Portsmouth',
    ]);

    $appendix = app(CarinaBaselineContextService::class)->appendixForUser($user);

    expect($appendix)->toContain('INVESTOR MEMORY (facts stored from previous sessions):')
        ->and($appendix)->toContain('investment-strategy: HMO focus, 6-bed, Portsmouth');

    tenancy()->end();
});

it('memory block is omitted when no memories exist', function (): void {
    [$tenant, $user] = memoryToolTenant();
    tenancy()->initialize($tenant);

    $appendix = app(CarinaBaselineContextService::class)->appendixForUser($user);

    expect($appendix)->not->toContain('INVESTOR MEMORY (facts stored from previous sessions):');

    tenancy()->end();
});

it('recalls memory stored in a previous conversation', function (): void {
    [$tenant, $user, $conversation] = memoryToolTenant();
    tenancy()->initialize($tenant);

    app(CarinaModuleToolDispatcher::class)->dispatch(
        'remember',
        ['key' => 'portfolio-city', 'value' => 'Portsmouth'],
        $user,
        $conversation,
    );

    $otherConversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Later thread',
    ]);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'recall',
        ['query' => 'which city is my portfolio focused on?'],
        $user,
        $otherConversation,
    );

    expect($result->success)->toBeTrue()
        ->and(collect($result->data['memories'] ?? [])->pluck('key')->all())->toContain('portfolio-city');

    tenancy()->end();
});

it('registers remember and recall in the Carina tool registry', function (): void {
    $names = array_map(fn ($tool) => $tool->name(), app(CarinaToolRegistry::class)->all());

    expect($names)->toContain('remember', 'recall');
});
