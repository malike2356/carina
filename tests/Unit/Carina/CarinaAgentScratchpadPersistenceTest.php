<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaAgentScratchpad;
use App\Models\Tenant\CarinaConversation;
use App\Services\Carina\CarinaAgentService;
use App\Services\Carina\Tools\ReadScratchpadTool;
use App\Services\Carina\Tools\WriteToScratchpadTool;
use App\Services\Tenancy\TenantCreationService;
use App\Support\TestingCentralCatalog;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

function resolveScratchpadTestTenant(): Tenant
{
    TestingCentralCatalog::realignCentralConnectionForTesting();

    $prefix = (string) config('tenancy.database.prefix', 'propreneur_t_');
    $catalogConn = TestingCentralCatalog::tenantMetadataConnectionInTests() ?? 'pgsql';

    $physicalDbs = collect(DB::connection($catalogConn)->select(
        "SELECT datname FROM pg_database WHERE datname LIKE ?",
        [$prefix.'%'],
    ))->pluck('datname')->flip();

    foreach (Tenant::query()->cursor() as $candidate) {
        $physicalName = $prefix.$candidate->getTenantKey();

        if (! $physicalDbs->has($physicalName)) {
            continue;
        }

        try {
            tenancy()->initialize($candidate);

            if (Schema::connection('tenant')->hasTable('carina_agent_scratchpads')) {
                tenancy()->end();

                return $candidate;
            }
        } catch (\Throwable) {
            //
        } finally {
            if (tenancy()->initialized) {
                tenancy()->end();
            }
        }
    }

    return app(TenantCreationService::class)->createTenant([
        'company_name' => 'Scratchpad '.Str::random(8),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.Str::random(8).'@scratchpad.test',
        'plan' => 'starter',
    ]);
}

beforeEach(function (): void {
    static $tenant;
    static $user;
    static $conversation;

    if ($tenant === null) {
        $tenant = resolveScratchpadTestTenant();
        tenancy()->initialize($tenant);

        expect(Schema::connection('tenant')->hasTable('carina_agent_scratchpads'))->toBeTrue();

        $user = UserFactory::new()->createOne();
        $conversation = CarinaConversation::query()->create([
            'user_id' => $user->id,
            'title' => 'Scratchpad test',
        ]);
    } else {
        tenancy()->initialize($tenant);
    }

    CarinaAgentScratchpad::where('conversation_id', $conversation->id)->delete();

    $this->user = $user;
    $this->conversation = $conversation;
    $this->writeTool = new WriteToScratchpadTool;
    $this->readTool = new ReadScratchpadTool;
});

it('writes a scratchpad entry', function (): void {
    $result = $this->writeTool->execute(
        ['key' => 'test-entry', 'value' => 'This is a test value'],
        $this->user,
        $this->conversation,
    );

    expect($result->success)->toBeTrue();

    $entry = CarinaAgentScratchpad::where('conversation_id', $this->conversation->id)
        ->where('key', 'test-entry')
        ->first();

    expect($entry)->not->toBeNull()
        ->and($entry->value)->toBe('This is a test value');
});

it('overwrites an existing scratchpad entry with the same key', function (): void {
    $this->writeTool->execute(['key' => 'my-key', 'value' => 'first value'], $this->user, $this->conversation);
    $this->writeTool->execute(['key' => 'my-key', 'value' => 'second value'], $this->user, $this->conversation);

    $count = CarinaAgentScratchpad::where('conversation_id', $this->conversation->id)
        ->where('key', 'my-key')
        ->count();

    expect($count)->toBe(1);

    $entry = CarinaAgentScratchpad::where('conversation_id', $this->conversation->id)
        ->where('key', 'my-key')
        ->first();

    expect($entry->value)->toBe('second value');
});

it('rejects an invalid key format', function (): void {
    $result = $this->writeTool->execute(
        ['key' => 'Invalid Key!', 'value' => 'some value'],
        $this->user,
        $this->conversation,
    );

    expect($result->success)->toBeFalse();
});

it('reads a specific scratchpad entry', function (): void {
    CarinaAgentScratchpad::writeEntry($this->conversation->id, 'deal-gdv', '£450,000');

    $result = $this->readTool->execute(['key' => 'deal-gdv'], $this->user, $this->conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['value'])->toBe('£450,000');
});

it('reads all scratchpad entries when no key is given', function (): void {
    CarinaAgentScratchpad::writeEntry($this->conversation->id, 'entry-a', 'value A');
    CarinaAgentScratchpad::writeEntry($this->conversation->id, 'entry-b', 'value B');

    $result = $this->readTool->execute([], $this->user, $this->conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['count'])->toBe(2)
        ->and($result->data['entries'])->toHaveKeys(['entry-a', 'entry-b']);
});

it('returns failure when reading a key that does not exist', function (): void {
    $result = $this->readTool->execute(['key' => 'does-not-exist'], $this->user, $this->conversation);

    expect($result->success)->toBeFalse();
});

it('returns empty entries gracefully when scratchpad is empty', function (): void {
    $result = $this->readTool->execute([], $this->user, $this->conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['entries'])->toBeEmpty();
});

it('does not leak scratchpad entries across conversations', function (): void {
    $otherConversation = CarinaConversation::query()->create([
        'user_id' => $this->user->id,
        'title' => 'Other',
    ]);

    CarinaAgentScratchpad::writeEntry($this->conversation->id, 'secret-key', 'secret-value');

    $result = $this->readTool->execute(['key' => 'secret-key'], $this->user, $otherConversation);

    expect($result->success)->toBeFalse();
});

it('clears all scratchpad entries for a conversation', function (): void {
    CarinaAgentScratchpad::writeEntry($this->conversation->id, 'k1', 'v1');
    CarinaAgentScratchpad::writeEntry($this->conversation->id, 'k2', 'v2');

    CarinaAgentScratchpad::clearForConversation($this->conversation->id);

    $count = CarinaAgentScratchpad::where('conversation_id', $this->conversation->id)->count();

    expect($count)->toBe(0);
});

it('buildScratchpadBlock returns empty string when scratchpad is empty', function (): void {
    $service = app(CarinaAgentService::class);
    $method = new ReflectionMethod($service, 'buildScratchpadBlock');
    $method->setAccessible(true);

    expect($method->invoke($service, $this->conversation))->toBe('');
});

it('buildScratchpadBlock formats active entries for the system prompt', function (): void {
    CarinaAgentScratchpad::writeEntry($this->conversation->id, 'deal-gdv', '£450,000');

    $service = app(CarinaAgentService::class);
    $method = new ReflectionMethod($service, 'buildScratchpadBlock');
    $method->setAccessible(true);
    $block = $method->invoke($service, $this->conversation);

    expect($block)->toContain('## Active Scratchpad Entries')
        ->and($block)->toContain('### [deal-gdv]')
        ->and($block)->toContain('£450,000');
});
