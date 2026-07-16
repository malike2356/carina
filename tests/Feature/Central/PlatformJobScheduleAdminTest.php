<?php

declare(strict_types=1);

use App\Models\Central\PlatformJobSchedule;
use App\Models\Central\PlatformUser;
use App\Services\Central\PlatformSchedulerHeartbeat;
use Illuminate\Support\Facades\Cache;

afterEach(function (): void {
    Cache::forget(PlatformSchedulerHeartbeat::CACHE_KEY);
});

it('redirects platform viewers away from job scheduler', function (): void {
    $u = PlatformUser::factory()->create(['role' => 'viewer']);

    $this->actingAs($u, 'platform')
        ->get(route('admin.job-schedules.index'))
        ->assertRedirect(route('central.login'));
});

it('shows job scheduler index for super admin', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.job-schedules.index'))
        ->assertOk()
        ->assertSee('Job scheduler', false)
        ->assertSee('Host scheduler', false);
});

it('shows runner ok when heartbeat is fresh', function (): void {
    Cache::put(PlatformSchedulerHeartbeat::CACHE_KEY, now()->toIso8601String(), 600);
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.job-schedules.index'))
        ->assertOk()
        ->assertSee('Runner OK', false);
});

it('updates cron expression for a schedule row', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $row = PlatformJobSchedule::query()->where('slug', 'deals-poll-listing-sources')->first();
    expect($row)->not->toBeNull();

    $this->actingAs($admin, 'platform')
        ->put(route('admin.job-schedules.update', $row), [
            'display_name' => $row->display_name,
            'description' => $row->description,
            'cron_expression' => '*/20 * * * *',
            'sort_order' => $row->sort_order,
            'is_enabled' => '1',
            'without_overlapping' => '1',
        ])
        ->assertRedirect(route('admin.job-schedules.index'));

    $row->refresh();
    expect($row->cron_expression)->toBe('*/20 * * * *');
});
