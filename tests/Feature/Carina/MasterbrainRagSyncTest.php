<?php

declare(strict_types=1);

use App\Jobs\Carina\SyncMasterbrainRagJob;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\Tenant;
use App\Services\Carina\MasterbrainRagSyncService;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\File;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('queues masterbrain rag sync from knowledge training api', function (): void {
    if (Tenant::query()->where('is_active', true)->doesntExist()) {
        test()->markTestSkipped('No active tenant in testing database.');
    }

    Bus::fake();

    $tmp = sys_get_temp_dir().'/mb_sync_api_'.uniqid('', true);
    File::makeDirectory($tmp, 0775, true);
    File::put($tmp.'/sync-test.md', "# Sync\n\nBody.");
    config(['carina.masterbrain_path' => $tmp]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->postJson(route('admin.carina.knowledge-training.sync-masterbrain-rag'), ['fresh' => true])
            ->assertStatus(202)
            ->assertJsonPath('status', 'queued');

        Bus::assertDispatched(SyncMasterbrainRagJob::class);
    } finally {
        File::deleteDirectory($tmp);
    }
});

it('rejects sync when no masterbrain markdown files exist', function (): void {
    $empty = sys_get_temp_dir().'/mb_empty_'.uniqid('', true);
    File::makeDirectory($empty, 0775, true);
    config(['carina.masterbrain_path' => $empty]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->postJson(route('admin.carina.knowledge-training.sync-masterbrain-rag'))
            ->assertStatus(422);
    } finally {
        File::deleteDirectory($empty);
    }
});
