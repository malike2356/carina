<?php

declare(strict_types=1);

use App\Models\Central\CarinaConversationInsight;
use App\Services\Carina\Insights\InsightPromotionService;
use Illuminate\Support\Facades\File;

it('creates a markdown file and updates insight status to promoted', function (): void {
    $insight = CarinaConversationInsight::query()->create([
        'source_type' => 'tenant',
        'source_conversation_hash' => hash('sha256', 'test'),
        'extract_type' => 'compliance_fact',
        'domain_tags' => ['compliance'],
        'quality_score' => 0.9,
        'title' => 'Test Gas Safety Fact',
        'content' => 'Some content.',
        'status' => 'approved',
    ]);

    $svc = new InsightPromotionService;
    $path = $svc->promote($insight);

    $insight->refresh();
    expect($insight->status)->toBe('promoted')
        ->and($insight->promoted_file_path)->toBe($path);

    $knowledgeRoot = rtrim((string) config('paths.brain.knowledge'), DIRECTORY_SEPARATOR.'/\\');
    $full = $knowledgeRoot.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $path);
    expect(is_file($full))->toBeTrue("Expected promoted markdown at: {$full}");

    File::delete($full);
    @rmdir(dirname($full));
});
