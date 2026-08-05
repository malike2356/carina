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
use App\Services\Carina\CarinaSkillLearningMemoryService;
use App\Services\Carina\CarinaSkillWriterService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

describe('Carina skill auto-learn', function (): void {
    it('evaluator runs the learning pipeline and extracts a skill', function (): void {
        Http::preventStrayRequests();

        $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
        $groq->update([
            'api_key' => 'gsk-skill-eval',
            'api_base_url' => 'https://api.skill-eval.invalid/openai/v1',
            'is_enabled' => true,
        ]);

        Http::fake([
            'https://api.skill-eval.invalid/openai/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'save' => true,
                                'score' => 13,
                                'category' => 'skill',
                                'title' => 'brr-checklist-pattern',
                                'summary' => 'Reusable BRR deal review structure.',
                                'why_it_matters' => ['Repeats across deal reviews', 'Improves consistency'],
                                'merge_target' => null,
                                'regression_risk' => 'low',
                                'recommended_action' => 'new',
                                'evidence' => [
                                    ['quote' => 'Here is the BRR validation sequence...', 'reason' => 'Shows the reusable structure'],
                                ],
                            ]),
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'name' => 'brr-checklist-pattern',
                                'description' => 'Reusable BRR deal review structure.',
                                'applies_when' => ['brr deal', 'refinance checklist'],
                                'inputs_needed' => ['deal price', 'refurb cost', 'refinance exit'],
                                'steps' => ['Review inputs', 'Check exit assumptions', 'Summarise the risk'],
                                'fallbacks' => ['Ask for missing figures', 'Use a simple checklist when data is incomplete'],
                                'do_not' => ['Do not assume missing numbers', 'Do not skip exit validation'],
                                'validation' => ['Run on a sample BRR deal and confirm the checklist is usable'],
                                'content' => 'Review purchase price, refurb costs, and refinance exit assumptions.',
                            ]),
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'allowed' => true,
                                'action' => 'write',
                                'reason' => 'No duplicate found.',
                                'duplicate_of' => null,
                                'boundary_notes' => ['Skill is narrow and operational'],
                                'required_fixes' => [],
                                'validation_required' => true,
                            ]),
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'pass' => true,
                                'issues' => [],
                                'recommended_patch' => 'No patch needed',
                                'merge_ready' => true,
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
            ->and($skill['name'])->toBe('brr-checklist-pattern')
            ->and($skill['applies_when'])->toContain('brr deal');
    });

    it('returns null when the evaluator says not to save', function (): void {
        Http::preventStrayRequests();

        $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
        $groq->update([
            'api_key' => 'gsk-skill-eval-skip',
            'api_base_url' => 'https://api.skill-eval-skip.invalid/openai/v1',
            'is_enabled' => true,
        ]);

        Http::fake([
            'https://api.skill-eval-skip.invalid/openai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'save' => false,
                            'score' => 2,
                            'category' => 'none',
                            'title' => '',
                            'summary' => '',
                            'why_it_matters' => [],
                            'merge_target' => null,
                            'regression_risk' => 'low',
                            'recommended_action' => 'discard',
                            'evidence' => [],
                        ]),
                    ],
                ]],
                'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
            ], 200),
        ]);

        expect(app(CarinaSessionEvaluatorService::class)->evaluate([
            'user' => 'Hello',
            'assistant' => 'Hi there.',
            'tools' => [],
        ], 'tenant-test'))->toBeNull();
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

    it('writer merges into a canonical target when a merge target is provided', function (): void {
        $skillsDir = storage_path('app/carina/skills-autolearn-merge-'.uniqid());
        File::ensureDirectoryExists($skillsDir);
        config(['carina.skills_path' => $skillsDir]);

        $target = $skillsDir.'/shared-existing-skill.md';
        File::put($target, <<<MD
---
name: existing-skill
description: Old description.
version: 1.0.0
applies_when:
  - old trigger
tags: [auto-generated, shared]
---

Old content.
MD);

        $writer = new CarinaSkillWriterService;
        $skill = [
            'name' => 'existing-skill',
            'description' => 'Updated description.',
            'applies_when' => ['new trigger', 'fallback trigger'],
            'content' => 'Updated content.',
            'merge_target' => 'shared-existing-skill.md',
        ];

        expect($writer->write($skill, 'shared'))->toBeTrue();
        $updated = file_get_contents($target);
        expect($updated)->toContain('Updated description.')
            ->and($updated)->toContain('new trigger')
            ->and($updated)->toContain('Updated content.')
            ->and($updated)->toContain('Old content.')
            ->and($updated)->toContain('Auto-learn update');

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
            'https://api.skill-job.invalid/openai/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'save' => true,
                                'score' => 13,
                                'category' => 'skill',
                                'title' => 'compliance-expiry-review',
                                'summary' => 'Review compliance items nearing expiry.',
                                'why_it_matters' => ['Recurring compliance task'],
                                'merge_target' => null,
                                'regression_risk' => 'low',
                                'recommended_action' => 'new',
                                'evidence' => [
                                    ['quote' => 'Here are the items due in the next 30 days.', 'reason' => 'Shows repeatable workflow'],
                                ],
                            ]),
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'name' => 'compliance-expiry-review',
                                'description' => 'Review compliance items nearing expiry.',
                                'applies_when' => ['compliance expiry', 'renewal due'],
                                'inputs_needed' => ['expiry date', 'owner', 'renewal status'],
                                'steps' => ['List items expiring soon', 'Assign owners', 'Summarise next action'],
                                'fallbacks' => ['Ask for missing expiry dates', 'Return a simple shortlist'],
                                'do_not' => ['Do not guess ownership', 'Do not hide missing renewal data'],
                                'validation' => ['Run it on a near-expiry sample set'],
                                'content' => 'List items expiring within 30 days and assign owners.',
                            ]),
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'allowed' => true,
                                'action' => 'merge',
                                'reason' => 'It fits an existing canonical file.',
                                'duplicate_of' => 'shared-existing-skill.md',
                                'merge_target' => 'shared-existing-skill.md',
                                'boundary_notes' => ['Safe to merge as a narrow skill'],
                                'required_fixes' => [],
                                'validation_required' => true,
                            ]),
                        ],
                    ]],
                    'usage' => ['prompt_tokens' => 4, 'completion_tokens' => 8],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'pass' => true,
                                'issues' => [],
                                'recommended_patch' => 'No patch needed',
                                'merge_ready' => true,
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
            app(CarinaSkillLearningMemoryService::class),
            new CarinaSkillWriterService,
        );

        expect(File::exists($skillsDir.'/shared-existing-skill.md'))->toBeTrue();
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

    it('appends a learning ledger record after processing a turn', function (): void {
        Queue::fake();
        Http::preventStrayRequests();

        $groq = AiProvider::query()->where('slug', 'groq')->firstOrFail();
        $groq->update([
            'api_key' => 'gsk-skill-ledger',
            'api_base_url' => 'https://api.skill-ledger.invalid/openai/v1',
            'is_enabled' => true,
        ]);

        Http::fake([
            'https://api.skill-ledger.invalid/openai/v1/chat/completions' => Http::sequence()
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'save' => true,
                                'score' => 12,
                                'category' => 'skill',
                                'title' => 'ledger-learning-rule',
                                'summary' => 'Keep a ledger entry for accepted learning turns.',
                                'why_it_matters' => ['Creates durable memory'],
                                'merge_target' => null,
                                'regression_risk' => 'low',
                                'recommended_action' => 'new',
                                'evidence' => [
                                    ['quote' => 'Record accepted turns after evaluation.', 'reason' => 'Shows persistent memory'],
                                ],
                                'learning_notes' => 'Memory should survive restarts.',
                                'repair_plan' => ['Append a JSONL ledger entry'],
                                'counterexamples' => ['Do not store raw transcripts'],
                                'confidence' => 0.91,
                            ]),
                        ],
                    ]],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'name' => 'ledger-learning-rule',
                                'description' => 'Keep a ledger entry for accepted learning turns.',
                                'applies_when' => ['auto learn', 'turn accepted'],
                                'inputs_needed' => ['tenant slug', 'skill name'],
                                'steps' => ['Append a ledger record', 'Use it in later prompts'],
                                'fallbacks' => ['Skip ledger write if storage is unavailable'],
                                'do_not' => ['Do not store transcripts'],
                                'validation' => ['Confirm the JSONL record exists'],
                                'content' => 'Append a durable JSONL record for every accepted learning turn.',
                            ]),
                        ],
                    ]],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'allowed' => true,
                                'action' => 'write',
                                'reason' => 'Unique learning pattern.',
                                'duplicate_of' => null,
                                'merge_target' => null,
                                'boundary_notes' => ['Safe and narrow'],
                                'required_fixes' => [],
                                'validation_required' => true,
                            ]),
                        ],
                    ]],
                ], 200)
                ->push([
                    'choices' => [[
                        'message' => [
                            'content' => json_encode([
                                'pass' => true,
                                'issues' => [],
                                'recommended_patch' => 'No patch needed',
                                'merge_ready' => true,
                            ]),
                        ],
                    ]],
                ], 200),
        ]);

        $skillsDir = storage_path('app/carina/skills-autolearn-ledger-'.uniqid());
        File::ensureDirectoryExists($skillsDir);
        config([
            'carina.skills_path' => $skillsDir,
            'carina.skill_learning.ledger_path' => storage_path('app/carina/skill-learning/ledger-'.uniqid().'.jsonl'),
        ]);

        $job = new CarinaSkillAutoLearnJob(
            [
                'user' => 'Please make this repeatable.',
                'assistant' => 'Here is the repeatable learning pattern.',
                'tools' => ['workflow_tool'],
            ],
            'ledger-demo',
            'tenant-ledger',
        );

        $job->handle(
            app(CarinaSessionEvaluatorService::class),
            app(CarinaSkillLearningMemoryService::class),
            new CarinaSkillWriterService,
        );

        $ledgerPath = config('carina.skill_learning.ledger_path');
        expect(File::exists($ledgerPath))->toBeTrue();
        expect(file_get_contents($ledgerPath))->toContain('ledger-learning-rule')
            ->and(file_get_contents($ledgerPath))->toContain('ledger-demo');

        File::deleteDirectory($skillsDir);
        File::delete($ledgerPath);
    });

    it('skips duplicate learning turns before running the evaluator', function (): void {
        Queue::fake();
        Http::preventStrayRequests();

        $skillsDir = storage_path('app/carina/skills-autolearn-dup-'.uniqid());
        File::ensureDirectoryExists($skillsDir);
        $ledgerPath = storage_path('app/carina/skill-learning/ledger-dup-'.uniqid().'.jsonl');
        config([
            'carina.skills_path' => $skillsDir,
            'carina.skill_learning.ledger_path' => $ledgerPath,
        ]);

        $turn = [
            'user' => 'Please make this repeatable.',
            'assistant' => 'Here is the repeatable learning pattern.',
            'tools' => ['workflow_tool'],
        ];

        $memory = app(CarinaSkillLearningMemoryService::class);
        File::ensureDirectoryExists(dirname($ledgerPath));
        File::put($ledgerPath, json_encode([
            'recorded_at' => now()->utc()->toIso8601String(),
            'tenant_slug' => 'ledger-demo',
            'action' => 'written',
            'skill_name' => 'ledger-learning-rule',
            'summary' => 'Keep a ledger entry for accepted learning turns.',
            'merge_target' => null,
            'fingerprint' => $memory->turnFingerprint($turn, 'ledger-demo'),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n");

        $job = new CarinaSkillAutoLearnJob(
            $turn,
            'ledger-demo',
            'tenant-ledger',
        );

        $evaluator = Mockery::mock(CarinaSessionEvaluatorService::class);
        $evaluator->shouldNotReceive('evaluate');
        $writer = Mockery::mock(CarinaSkillWriterService::class);
        $writer->shouldNotReceive('write');

        $job->handle($evaluator, $memory, $writer);

        Queue::assertNothingPushed();
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/', (string) File::get($ledgerPath)) ?: [])));
        expect($lines)->toHaveCount(1);

        File::deleteDirectory($skillsDir);
        File::delete($ledgerPath);
    });

    it('prunes the learning ledger to the configured maximum', function (): void {
        $ledgerPath = storage_path('app/carina/skill-learning/ledger-prune-'.uniqid().'.jsonl');
        config(['carina.skill_learning.ledger_path' => $ledgerPath]);

        $memory = app(CarinaSkillLearningMemoryService::class);
        for ($i = 1; $i <= 5; $i++) {
            $memory->appendRecord([
                'tenant_slug' => 'prune-demo',
                'action' => 'written',
                'skill_name' => 'skill-'.$i,
                'summary' => 'Record '.$i,
                'merge_target' => null,
                'fingerprint' => 'fingerprint-'.$i,
            ]);
        }

        $memory->pruneLedger(3);

        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/', (string) File::get($ledgerPath)) ?: [])));
        expect($lines)->toHaveCount(3)
            ->and($lines[0])->toContain('skill-3')
            ->and($lines[2])->toContain('skill-5');

        File::delete($ledgerPath);
    });
});
