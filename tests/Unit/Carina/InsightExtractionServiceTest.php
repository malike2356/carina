<?php

declare(strict_types=1);

use App\Services\Carina\CarinaService;
use App\Services\Carina\Insights\ConversationPreRedactor;
use App\Services\Carina\Insights\InsightExtractionService;

it('returns empty array when llm returns empty json array', function (): void {
    $mock = Mockery::mock(CarinaService::class);
    $mock->shouldReceive('backgroundCompletionCall')->once()->andReturn('[]');
    $svc = new InsightExtractionService($mock, new ConversationPreRedactor);
    $messages = collect([
        (object) ['role' => 'user', 'content' => 'hi'],
        (object) ['role' => 'assistant', 'content' => 'Hello'],
    ]);
    expect($svc->extractFromMessages($messages, 'tenant', 'abc'))->toBe([]);
});

it('parses valid insight json and filters low quality', function (): void {
    $json = json_encode([
        ['extract_type' => 'compliance_fact', 'domain_tags' => ['compliance'], 'quality_score' => 0.9, 'title' => 'Gas Safety', 'content' => 'Gas safety certificates...', 'was_anonymised' => true],
        ['extract_type' => 'qa_pair', 'domain_tags' => ['general'], 'quality_score' => 0.4, 'title' => 'Low quality', 'content' => 'Not useful', 'was_anonymised' => true],
    ]);
    $mock = Mockery::mock(CarinaService::class);
    $mock->shouldReceive('backgroundCompletionCall')->once()->andReturn((string) $json);
    $svc = new InsightExtractionService($mock, new ConversationPreRedactor);
    $messages = collect([
        (object) ['role' => 'user', 'content' => 'Tell me about gas certs'],
        (object) ['role' => 'assistant', 'content' => 'Gas safety certificates must be renewed annually...'],
    ]);
    $results = $svc->extractFromMessages($messages, 'tenant', 'xyz');
    expect($results)->toHaveCount(1)
        ->and($results[0]->title)->toBe('Gas Safety');
});

it('returns empty array when llm returns malformed json', function (): void {
    $mock = Mockery::mock(CarinaService::class);
    $mock->shouldReceive('backgroundCompletionCall')->once()->andReturn('not json at all');
    $svc = new InsightExtractionService($mock, new ConversationPreRedactor);
    $messages = collect([
        (object) ['role' => 'user', 'content' => 'test'],
        (object) ['role' => 'assistant', 'content' => 'test reply'],
    ]);
    expect($svc->extractFromMessages($messages, 'tenant', 'hash'))->toBe([]);
});
