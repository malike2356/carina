<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaAgentService;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\CarinaService;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\Tools\ToolResult;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
});

/**
 * @return array{0: Tenant, 1: User, 2: CarinaConversation}
 */
function clarifyToolTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Clarify Tool '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@clarify-tool.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Clarify thread',
    ]);

    tenancy()->end();

    return [$tenant, $user, $conversation];
}

it('returns clarification_requested payload from clarify tool', function (): void {
    [$tenant, $user, $conversation] = clarifyToolTenant();
    tenancy()->initialize($tenant);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'clarify',
        [
            'question' => 'What purchase price should I use for the BTL calculator?',
            'context' => 'The BTL calculator needs this to calculate yield.',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['clarification_requested'] ?? null)->toBeTrue()
        ->and($result->data['question'] ?? null)->toBe('What purchase price should I use for the BTL calculator?')
        ->and($result->data['context'] ?? null)->toBe('The BTL calculator needs this to calculate yield.')
        ->and($result->data['options'] ?? null)->toBe([]);

    tenancy()->end();
});

it('clarify tool with options returns options array in response', function (): void {
    [$tenant, $user, $conversation] = clarifyToolTenant();
    tenancy()->initialize($tenant);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'clarify',
        [
            'question' => 'What LTV are you assuming for the bridging finance?',
            'options' => ['70%', '75%', '80%'],
            'context' => 'The BRR calculator needs this to calculate the monthly bridging cost.',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['options'] ?? null)->toBe(['70%', '75%', '80%']);

    tenancy()->end();
});

it('clarify tool without options returns empty options array', function (): void {
    [$tenant, $user, $conversation] = clarifyToolTenant();
    tenancy()->initialize($tenant);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'clarify',
        ['question' => 'Which property address should I use?'],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['options'] ?? null)->toBe([]);

    tenancy()->end();
});

it('executeTool clarify survives argument validator coercion', function (): void {
    [$tenant, $user, $conversation] = clarifyToolTenant();
    tenancy()->initialize($tenant);

    $service = app(CarinaAgentService::class);
    $method = new ReflectionMethod($service, 'executeTool');
    $method->setAccessible(true);

    /** @var ToolResult $result */
    $result = $method->invoke(
        $service,
        'clarify',
        [
            'question' => 'What purchase price should I use?',
            'options' => ['200000', '250000'],
            'context' => 'BTL calculator needs purchase price.',
        ],
        $user,
        $conversation,
        1,
    );

    expect($result->success)->toBeTrue("summary={$result->summary} error={$result->error}")
        ->and($result->data['clarification_requested'] ?? null)->toBeTrue();

    tenancy()->end();
});

it('agent loop returns early with clarification shape when clarify is called', function (): void {
    [$tenant, $user, $conversation] = clarifyToolTenant();
    tenancy()->initialize($tenant);

    $carina = Mockery::mock(CarinaService::class);
    $carina->shouldReceive('applyTenantCarinaInputSecurity')
        ->once()
        ->andReturnUsing(static fn (CarinaConversation $c, string $message): string => $message);
    $carina->shouldReceive('buildAgentContext')
        ->once()
        ->andReturn([
            'system_prompt' => 'Test system prompt.',
            'history' => [],
        ]);
    $carina->shouldReceive('agentTurn')
        ->once()
        ->andReturn([
            'text' => '',
            'tool_calls' => [[
                'id' => 'toolu_clarify_1',
                'name' => 'clarify',
                'input' => [
                    'question' => 'What purchase price should I use?',
                    'options' => ['200000', '250000'],
                    'context' => 'BTL calculator needs purchase price.',
                ],
            ]],
            'stop_reason' => 'tool_use',
            'raw_content' => [
                ['type' => 'tool_use', 'id' => 'toolu_clarify_1', 'name' => 'clarify', 'input' => []],
            ],
            'input_tokens' => 12,
            'output_tokens' => 8,
            'provider_used' => 'anthropic',
            'model_used' => 'claude-test',
        ]);
    $carina->shouldReceive('persistAgentResult')
        ->once()
        ->withArgs(function (CarinaConversation $conv, string $userMessage, string $reply): bool {
            return $reply === 'What purchase price should I use?'
                && $userMessage === 'Run a BTL calculator for a property.';
        });

    app()->instance(CarinaService::class, $carina);
    app()->forgetInstance(CarinaAgentService::class);

    $result = app(CarinaAgentService::class)->agentChat(
        $conversation,
        'Run a BTL calculator for a property.',
        $user,
    );

    expect($result['clarification_requested'] ?? null)->toBeTrue()
        ->and($result['clarification_question'] ?? null)->toBe('What purchase price should I use?')
        ->and($result['clarification_options'] ?? null)->toBe(['200000', '250000'])
        ->and($result['clarification_context'] ?? null)->toBe('BTL calculator needs purchase price.')
        ->and($result['reply'])->toBe('What purchase price should I use?')
        ->and($result['requires_confirmation'])->toBeFalse()
        ->and($result['actions'])->toHaveCount(1)
        ->and($result['actions'][0]['tool'])->toBe('clarify');

    tenancy()->end();
});

it('registers clarify in the tenant carina tool registry', function (): void {
    $registry = app(CarinaToolRegistry::class);
    $names = array_map(static fn ($tool) => $tool->name(), $registry->all());

    expect($names)->toContain('clarify');
});
