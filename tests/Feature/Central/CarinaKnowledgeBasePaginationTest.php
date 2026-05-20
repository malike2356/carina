<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

it('paginates knowledge base file list', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();
    $tmp = sys_get_temp_dir().'/carina-kb-'.uniqid('', true);
    mkdir($tmp);

    try {
        for ($i = 1; $i <= 30; $i++) {
            file_put_contents("{$tmp}/doc-{$i}.md", "# Document {$i}\n");
        }

        config(['paths.brain.knowledge' => $tmp]);

        $this->actingAs($admin, 'platform')
            ->get(route('admin.carina.knowledge-base.index'))
            ->assertOk()
            ->assertSee('Showing 1', false)
            ->assertSee('of 30 files', false)
            ->assertSee('doc-1.md', false)
            ->assertDontSee('doc-26.md', false);

        $this->actingAs($admin, 'platform')
            ->get(route('admin.carina.knowledge-base.index', ['page' => 2]))
            ->assertOk()
            ->assertSee('doc-26.md', false);
    } finally {
        foreach (glob($tmp.'/*.md') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($tmp);
    }
});
