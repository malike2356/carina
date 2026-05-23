<?php

declare(strict_types=1);

namespace Tests\Support\Stubs;

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\Contracts\CarinaAgentChatRunner;

final class StubCarinaAgentChatRunner implements CarinaAgentChatRunner
{
    /**
     * @param  array{
     *     reply: string,
     *     actions: list<array{tool: string, args: array<string, mixed>, result: string, success: bool}>,
     *     requires_confirmation: bool,
     *     pending_action: array<string, mixed>|null,
     *     steps_used: int,
     * }  $agentChatResult
     */
    public function __construct(
        private readonly array $agentChatResult = [
            'reply' => 'Agent stub reply.',
            'actions' => [],
            'requires_confirmation' => false,
            'pending_action' => null,
            'steps_used' => 1,
        ],
    ) {}

    public function agentChat(
        CarinaConversation $conversation,
        string $userMessage,
        ?User $user = null,
        ?array $uiContext = null,
        ?int $maxStepsOverride = null,
    ): array {
        return $this->agentChatResult;
    }

    public function resumeFromConfirmation(
        CarinaConversation $conversation,
        string $token,
        bool $approved,
        ?User $user,
    ): array {
        return $this->agentChatResult;
    }
}
