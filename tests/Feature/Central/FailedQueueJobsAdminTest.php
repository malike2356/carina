<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'platform_job_schedules')->update(['enabled' => true]);
});

it('shows failed queue jobs admin page for super admin', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    DB::connection('central')->table('failed_jobs')->insert([
        'uuid' => (string) Str::uuid(),
        'connection' => 'redis',
        'queue' => 'rag-processing',
        'payload' => json_encode(['displayName' => 'App\\Jobs\\Rag\\ProcessDocumentJob']),
        'exception' => "RuntimeException: test failure\n",
        'failed_at' => now(),
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.failed-jobs.index'))
        ->assertOk()
        ->assertSee('Failed queue jobs', false)
        ->assertSee('ProcessDocumentJob', false);
});

it('redirects viewers away from failed queue jobs page', function (): void {
    $user = PlatformUser::factory()->create(['role' => 'viewer']);

    $this->actingAs($user, 'platform')
        ->get(route('admin.failed-jobs.index'))
        ->assertRedirect(route('central.login'));
});
