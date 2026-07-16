<?php

declare(strict_types=1);

use App\Jobs\Carina\CarinaCompileSkillsJob;
use App\Jobs\Carina\CarinaSkillAutoLearnJob;
use App\Models\Central\AiProvider;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaAgentService;
use App\Services\Carina\CarinaService;
use App\Services\Carina\CarinaSessionEvaluatorService;
use App\Services\Carina\CarinaSkillWriterService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

describe('Carina skill auto-learn', function (): void {
    it('parses a valid skill JSON response', function (): void {
        $evaluator = app(CarinaSessionEvaluatorService::class);
        $method = new ReflectionMethod($evaluator, 'parseSkillResponse');
        $method->setAccessible(true);

        $skill = $method->invoke($evaluator, json_encode([
            'worth_saving' => true,
            'name' => 'deal-brr-checklist',
            'description' => 'Steps to validate a BRR deal before exchange.',
            'applies_when' => ['brr deal', 'refinance checklist'],
            'content' => 'Review purchase price, refurb costs, and refinance exit assumptions.',
        ]));

        expect($skill)->not->toBeNull()
            ->and($skill['name'])->toBe('deal-brr-checklist')
            ->and($skill['applies_when'])->toContain('brr deal');
    });

    it('returns null when parsed JSON says not worth saving', function (): void {
        $evaluator = app(CarinaSessionEvaluatorService::class);
        $method = new ReflectionMethod($evaluator, 'parseSkillResponse');
        $method->setAccessible(true);

        expect($method->invoke($evaluator, '{"worth_saving": false}'))->toBeNull();
    });

    it('evaluator calls AI router and extracts a skill', function (): void {
        Http::preventStrayRequests();

        $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
        $groq->update([
            'api_key' => 'gsk-skill-eval',
            'api_base_url' => 'https://api.skill-eval.invalid/openai/v1',
            'is_enabled' => true,
        ]);

        Http::fake([
            'https://api.skill-eval.invalid/openai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'worth_saving' => true,
                            'name' => 'deal-brr-checklist',
                            'description' => 'Steps to validate a BRR deal before exchange.',
                            'applies_when' => ['brr deal'],
                            'content' => 'Review purchase price and refurb costs.',
                        ]),
                    ],
                ]],
                'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
            ], 200),
        ]);

        $skill = app(CarinaSessionEvaluatorService::class)->evaluate([
            'user' => 'Can you run a BRR checklist for this deal?',
            'assistant' => 'Here is the BRR validation sequence...',
            'tools' => ['deal_calculator'],
        ], 'tenant-test');

        expect($skill)->not->toBeNull()
            ->and($skill['name'])->toBe('deal-brr-checklist');
    });

    it('writer creates a skill file and skips duplicates', function (): void {
        $skillsDir = storage_path('app/carina/skills-autolearn-'.uniqid());
        File::ensureDirectoryExists($skillsDir);
        config(['carina.skills_path' => $skillsDir]);

        $writer = new CarinaSkillWriterService;
        $skill = [
            'name' => 'test-auto-skill',
            'description' => 'Auto-generated test skill.',
            'applies_when' => ['test phrase'],
            'content' => 'Follow this repeatable approach.',
        ];

        expect($writer->write($skill, 'xelox'))->toBeTrue()
            ->and($writer->write($skill, 'xelox'))->toBeFalse();

        $path = $skillsDir.'/xelox-test-auto-skill.md';
        expect(File::exists($path))->toBeTrue();
        expect(file_get_contents($path))->toContain('name: test-auto-skill');

        File::deleteDirectory($skillsDir);
    });

    it('auto learn job writes skill and queues compile', function (): void {
        Queue::fake();
        Http::preventStrayRequests();

        $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
        $groq->update([
            'api_key' => 'gsk-skill-job',
            'api_base_url' => 'https://api.skill-job.invalid/openai/v1',
            'is_enabled' => true,
        ]);

        Http::fake([
            'https://api.skill-job.invalid/openai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'worth_saving' => true,
                            'name' => 'compliance-expiry-review',
                            'description' => 'Review compliance items nearing expiry.',
                            'applies_when' => ['compliance expiry', 'renewal due'],
                            'content' => 'List items expiring within 30 days and assign owners.',
                        ]),
                    ],
                ]],
                'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
            ], 200),
        ]);

        $skillsDir = storage_path('app/carina/skills-autolearn-job-'.uniqid());
        File::ensureDirectoryExists($skillsDir);
        config(['carina.skills_path' => $skillsDir]);

        $job = new CarinaSkillAutoLearnJob(
            [
                'user' => 'What compliance items expire soon?',
                'assistant' => 'Here are the items due in the next 30 days.',
                'tools' => ['compliance_list'],
            ],
            'demo',
            'tenant-demo',
        );

        $job->handle(
            app(CarinaSessionEvaluatorService::class),
            new CarinaSkillWriterService,
        );

        expect(File::exists($skillsDir.'/demo-compliance-expiry-review.md'))->toBeTrue();
        Queue::assertPushed(CarinaCompileSkillsJob::class);

        File::deleteDirectory($skillsDir);
    });

    it('agentChat dispatches auto learn job when feature is enabled', function (): void {
        Queue::fake();
        config(['carina.auto_skill_learn' => true]);

        $tenant = app(TenantCreationService::class)->createTenant([
            'company_name' => 'Auto Learn '.uniqid(),
            'owner_name' => 'Owner',
            'owner_email' => 'owner-'.uniqid().'@auto-learn.test',
            'plan' => 'starter',
        ]);

        tenancy()->initialize($tenant);
        TenantRole::findOrCreate('tenant_admin', 'web');
        $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
        $user->syncRoles(['tenant_admin']);
        completeTenantWorkspaceOnboarding();

        $conversation = CarinaConversation::query()->create([
            'type' => 'chat',
            'tenant_id' => (string) $tenant->getTenantKey(),
            'user_id' => $user->id,
            'title' => 'Auto learn test',
        ]);

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
                'text' => 'I reviewed your deal and here is the summary.',
                'tool_calls' => [],
                'stop_reason' => 'end_turn',
                'raw_content' => [],
                'input_tokens' => 10,
                'output_tokens' => 12,
                'provider_used' => 'groq',
                'model_used' => 'test-model',
            ]);
        $carina->shouldReceive('finalizeAssistantReplyPublic')
            ->once()
            ->andReturn('I reviewed your deal and here is the summary.');
        $carina->shouldReceive('persistAgentResult')->once();

        app()->instance(CarinaService::class, $carina);
        app()->forgetInstance(CarinaAgentService::class);

        $result = app(CarinaAgentService::class)->agentChat(
            $conversation,
            'Summarise this BRR deal for me.',
            $user,
        );

        expect($result['reply'])->toBe('I reviewed your deal and here is the summary.');

        Queue::assertPushed(CarinaSkillAutoLearnJob::class, function (CarinaSkillAutoLearnJob $job): bool {
            return $job->turn['user'] === 'Summarise this BRR deal for me.'
                && str_contains($job->turn['assistant'], 'reviewed your deal');
        });

        tenancy()->end();
    });
});
