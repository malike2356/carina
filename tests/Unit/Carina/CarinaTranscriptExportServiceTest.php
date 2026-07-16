<?php

declare(strict_types=1);

use App\Services\Carina\CarinaTranscriptExportService;
use Carbon\Carbon;

it('renders plain text with labelled turns', function (): void {
    $svc = app(CarinaTranscriptExportService::class);

    $messages = collect([
        (object) ['role' => 'user', 'content' => 'Hello', 'created_at' => Carbon::parse('2026-05-01 12:00:00', 'UTC')],
        (object) ['role' => 'assistant', 'content' => 'Hi', 'created_at' => Carbon::parse('2026-05-01 12:00:05', 'UTC')],
    ]);

    $out = $svc->asPlainText(['Workspace' => 'Acme Ltd'], $messages, 'You', 'Carina');

    expect($out)->toContain('Propreneur Carina transcript')
        ->and($out)->toContain('Workspace: Acme Ltd')
        ->and($out)->toContain('You @')
        ->and($out)->toContain('Hello')
        ->and($out)->toContain('Carina @')
        ->and($out)->toContain('Hi');
});

it('renders JSON with message array', function (): void {
    $svc = app(CarinaTranscriptExportService::class);

    $messages = collect([
        (object) ['role' => 'user', 'content' => 'Q', 'created_at' => Carbon::parse('2026-05-01 12:00:00', 'UTC')],
    ]);

    $json = $svc->asJson('tenant_workspace', ['id' => 1, 'title' => 'T'], $messages);
    $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

    expect($data['kind'])->toBe('tenant_workspace')
        ->and($data['messages'][0]['role'])->toBe('user')
        ->and($data['messages'][0]['content'])->toBe('Q');
});
