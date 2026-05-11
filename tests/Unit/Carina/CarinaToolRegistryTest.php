<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\Tools\CarinaTool;
use App\Services\Carina\Tools\ToolResult;

beforeEach(function (): void {
    $this->registry = new CarinaToolRegistry;
});

it('registers and finds a tool by name', function (): void {
    $tool = new class extends CarinaTool {
        public function name(): string { return 'test_tool'; }
        public function description(): string { return 'Test tool'; }
        public function inputSchema(): array { return ['type' => 'object', 'properties' => []]; }
        public function execute(array $args, ?User $user, CarinaConversation $conversation): ToolResult
        {
            return new ToolResult(true, 'done');
        }
    };

    $this->registry->register($tool);

    expect($this->registry->find('test_tool'))->toBe($tool);
});

it('returns null for unknown tool name', function (): void {
    expect($this->registry->find('nonexistent'))->toBeNull();
});

it('filters out tools whose authorize returns false', function (): void {
    $publicTool = new class extends CarinaTool {
        public function name(): string { return 'public'; }
        public function description(): string { return ''; }
        public function inputSchema(): array { return ['type' => 'object', 'properties' => []]; }
        public function execute(array $args, ?User $user, CarinaConversation $conversation): ToolResult
        {
            return new ToolResult(true, 'done');
        }
        public function authorize(?User $user): bool { return true; }
    };

    $restrictedTool = new class extends CarinaTool {
        public function name(): string { return 'restricted'; }
        public function description(): string { return ''; }
        public function inputSchema(): array { return ['type' => 'object', 'properties' => []]; }
        public function execute(array $args, ?User $user, CarinaConversation $conversation): ToolResult
        {
            return new ToolResult(true, 'done');
        }
        public function authorize(?User $user): bool { return false; }
    };

    $this->registry->register($publicTool);
    $this->registry->register($restrictedTool);

    $user = $this->createMock(User::class);
    $authorized = $this->registry->authorizedFor($user);

    expect($authorized)->toHaveCount(1)
        ->and($authorized[0]->name())->toBe('public');
});

it('returns correct Anthropic schema format', function (): void {
    $tool = new class extends CarinaTool {
        public function name(): string { return 'test'; }
        public function description(): string { return 'A tool'; }
        public function inputSchema(): array { return ['type' => 'object', 'properties' => ['a' => ['type' => 'string']], 'required' => ['a']]; }
        public function execute(array $args, ?User $user, CarinaConversation $conversation): ToolResult
        {
            return new ToolResult(true, 'done');
        }
    };

    $user = $this->createMock(User::class);
    $this->registry->register($tool);
    $schemas = $this->registry->anthropicSchemas($user);

    expect($schemas)->toHaveCount(1);
    expect($schemas[0])
        ->toHaveKey('name', 'test')
        ->toHaveKey('description', 'A tool')
        ->toHaveKey('input_schema');
    expect($schemas[0]['input_schema'])
        ->toHaveKey('properties')
        ->toHaveKey('required', ['a']);
});

it('returns correct OpenAI schema format', function (): void {
    $tool = new class extends CarinaTool {
        public function name(): string { return 'test'; }
        public function description(): string { return 'A tool'; }
        public function inputSchema(): array { return ['type' => 'object', 'properties' => [], 'required' => []]; }
        public function execute(array $args, ?User $user, CarinaConversation $conversation): ToolResult
        {
            return new ToolResult(true, 'done');
        }
    };

    $user = $this->createMock(User::class);
    $this->registry->register($tool);
    $schemas = $this->registry->openAiSchemas($user);

    expect($schemas)->toHaveCount(1);
    expect($schemas[0])
        ->toHaveKey('type', 'function')
        ->toHaveKey('function');
    expect($schemas[0]['function'])
        ->toHaveKey('name', 'test')
        ->toHaveKey('description', 'A tool')
        ->toHaveKey('parameters');
});
