<?php

declare(strict_types=1);

use App\Models\Central\CarinaConversationInsight;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Services\Carina\Insights\CarinaInsightsAutomation;
use App\Services\Carina\Insights\InsightAutoPromotionService;
use Illuminate\Support\Facades\File;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('persists insight automation settings from admin api', function (): void {
    $this->actingAs($this->superAdmin, 'platform')
        ->postJson(route('admin.carina.insights.automation'), [
            'enabled' => true,
            'min_score' => 0.85,
        ])
        ->assertOk()
        ->assertJsonPath('automation.enabled', true)
        ->assertJsonPath('automation.min_score', 0.85);

    expect(app(CarinaInsightsAutomation::class)->minScore())->toBe(0.85);
});

it('auto approves and promotes high scoring staged insights', function (): void {
    app(CarinaInsightsAutomation::class)->persist(['enabled' => true, 'min_score' => 0.8]);

    $high = CarinaConversationInsight::query()->create([
        'source_type' => 'tenant',
        'source_conversation_hash' => hash('sha256', 'high'),
        'extract_type' => 'compliance_fact',
        'quality_score' => 0.9,
        'title' => 'High score fact',
        'content' => 'Educational content.',
        'status' => 'staged',
    ]);

    CarinaConversationInsight::query()->create([
        'source_type' => 'tenant',
        'source_conversation_hash' => hash('sha256', 'low'),
        'extract_type' => 'market_insight',
        'quality_score' => 0.65,
        'title' => 'Lower score',
        'content' => 'Still useful but manual.',
        'status' => 'staged',
    ]);

    $result = app(InsightAutoPromotionService::class)->runPipeline();

    expect($result['approved'])->toBe(1)
        ->and($result['promoted'])->toBe(1);

    $high->refresh();
    expect($high->status)->toBe('promoted')
        ->and($high->promoted_file_path)->not->toBeNull();

    $knowledgeRoot = rtrim((string) config('paths.brain.knowledge'), DIRECTORY_SEPARATOR.'/\\');
    $full = $knowledgeRoot.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, (string) $high->promoted_file_path);
    expect(is_file($full))->toBeTrue();
    File::delete($full);
    @rmdir(dirname($full));

    app(CarinaInsightsAutomation::class)->persist(['enabled' => false]);
});

it('promotes immediately after manual approve when score meets threshold', function (): void {
    app(CarinaInsightsAutomation::class)->persist(['enabled' => true, 'min_score' => 0.75]);

    $insight = CarinaConversationInsight::query()->create([
        'source_type' => 'tenant',
        'source_conversation_hash' => hash('sha256', 'manual'),
        'extract_type' => 'qa_pair',
        'quality_score' => 0.82,
        'title' => 'Manual approve promote',
        'content' => 'Q and A.',
        'status' => 'staged',
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->patch(route('admin.carina.insights.approve', $insight))
        ->assertRedirect()
        ->assertSessionHas('success');

    $insight->refresh();
    expect($insight->status)->toBe('promoted');

    app(CarinaInsightsAutomation::class)->persist(['enabled' => false]);
});
