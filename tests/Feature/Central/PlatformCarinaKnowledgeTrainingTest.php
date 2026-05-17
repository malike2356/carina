<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use App\Models\Central\PlatformUser;
use App\Services\Carina\CarinaKnowledgeTrainingAutomation;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\File;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('shows carina knowledge training page for super admin', function (): void {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.carina.knowledge-training.index'))
        ->assertOk()
        ->assertSee('Carina knowledge training', false)
        ->assertSee('RAG automation', false);
});

it('forbids knowledge training without manage-carina-knowledge-training', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.carina.knowledge-training.index'))
        ->assertForbidden();
});

it('validates analyse requires at least one file', function (): void {
    $this->actingAs($this->superAdmin, 'platform')
        ->postJson(route('admin.carina.knowledge-training.analyze'), [])
        ->assertStatus(422);
});

it('preview save returns dry run payload', function (): void {
    $tmp = sys_get_temp_dir().'/mb_kt_preview_'.uniqid('', true);
    File::makeDirectory($tmp, 0775, true);
    config(['carina.masterbrain_path' => $tmp]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->postJson(route('admin.carina.knowledge-training.preview-save'), [
                'subfolder' => '',
                'document_title' => 'Preview Only',
                'conflict_policy' => 'increment',
                'markdown_body' => "# New\n",
            ])
            ->assertOk()
            ->assertJsonPath('dry_run', true)
            ->assertJsonPath('file_exists', false);
    } finally {
        File::deleteDirectory($tmp);
    }
});

it('returns not found when carina_ai feature is disabled', function (): void {
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => false]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->get(route('admin.carina.knowledge-training.index'))
            ->assertNotFound();
    } finally {
        FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true]);
    }
});

it('saves curated markdown under configured masterbrain path', function (): void {
    $tmp = sys_get_temp_dir().'/mb_kt_'.uniqid('', true);
    File::makeDirectory($tmp, 0775, true);
    config(['carina.masterbrain_path' => $tmp]);

    try {
        $response = $this->actingAs($this->superAdmin, 'platform')
            ->postJson(route('admin.carina.knowledge-training.save'), [
                'subfolder' => '',
                'document_title' => 'Test training doc',
                'markdown_body' => "# Title\n\nBody.",
                'unrelated_to_product' => false,
                'confirm_unrelated' => false,
                'original_filename' => 'source.txt',
            ]);

        $response->assertOk();
        $this->assertStringStartsWith('brain/masterbrain/', (string) $response->json('repository_relative'));

        $path = (string) $response->json('absolute_path');
        expect(is_file($path))->toBeTrue();
        expect(file_get_contents($path))->toContain('propreneur_carina_training: true');
        expect(file_get_contents($path))->toContain('# Title');
    } finally {
        File::deleteDirectory($tmp);
    }
});

it('persists knowledge training automation settings', function (): void {
    $this->actingAs($this->superAdmin, 'platform')
        ->postJson(route('admin.carina.knowledge-training.automation'), [
            'enabled' => true,
            'scope' => CarinaKnowledgeTrainingAutomation::SCOPE_ALL_ACTIVE,
        ])
        ->assertOk()
        ->assertJsonPath('automation.enabled', true)
        ->assertJsonPath('automation.scope', CarinaKnowledgeTrainingAutomation::SCOPE_ALL_ACTIVE);

    expect(PlatformSetting::query()->where('key', 'carina_training_auto_rag_after_save')->value('value'))->toBe('1');
    expect(PlatformSetting::query()->where('key', 'carina_training_auto_rag_scope')->value('value'))
        ->toBe(CarinaKnowledgeTrainingAutomation::SCOPE_ALL_ACTIVE);
});

it('auto queues rag after save when automation is enabled', function (): void {
    $tmp = sys_get_temp_dir().'/mb_kt_auto_'.uniqid('', true);
    File::makeDirectory($tmp, 0775, true);
    config(['carina.masterbrain_path' => $tmp]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Auto RAG Test',
        'owner_name' => 'Owner',
        'owner_email' => 'auto-rag-'.uniqid().'@test.local',
        'plan' => 'starter',
    ]);

    app(CarinaKnowledgeTrainingAutomation::class)->persist([
        'enabled' => true,
        'scope' => CarinaKnowledgeTrainingAutomation::SCOPE_SELECTED,
    ]);

    try {
        $response = $this->actingAs($this->superAdmin, 'platform')
            ->postJson(route('admin.carina.knowledge-training.save'), [
                'subfolder' => '',
                'document_title' => 'Auto rag doc',
                'markdown_body' => "# Auto\n\nBody.",
                'unrelated_to_product' => false,
                'confirm_unrelated' => false,
                'original_filename' => 'source.txt',
                'central_tenant_id' => $tenant->id,
            ]);

        $response->assertOk();
        $response->assertJsonPath('auto_rag.enabled', true);
        expect($response->json('auto_rag.queued'))->toBeArray()->not->toBeEmpty();
    } finally {
        app(CarinaKnowledgeTrainingAutomation::class)->persist(['enabled' => false]);
        File::deleteDirectory($tmp);
    }
});

it('rejects unrelated save without operator confirmation', function (): void {
    $tmp = sys_get_temp_dir().'/mb_kt_'.uniqid('', true);
    File::makeDirectory($tmp, 0775, true);
    config(['carina.masterbrain_path' => $tmp]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->postJson(route('admin.carina.knowledge-training.save'), [
                'subfolder' => '',
                'document_title' => 'Edge',
                'markdown_body' => '# X',
                'unrelated_to_product' => true,
                'confirm_unrelated' => false,
                'original_filename' => 'x.txt',
            ])
            ->assertStatus(422);
    } finally {
        File::deleteDirectory($tmp);
    }
});
