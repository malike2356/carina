<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Models\Central\Tenant;
use App\Services\Persona\PersonaWorkspaceModeSwitchPolicy;
use Illuminate\Support\Carbon;

beforeEach(function (): void {
    PlatformSetting::query()
        ->where('key', PersonaWorkspaceModeSwitchPolicy::PLATFORM_SETTING_KEY)
        ->delete();
});

it('allows mode switch immediately when minimum days is zero', function (): void {
    config(['persona_workspace.mode_switch_min_workspace_age_days' => 0]);

    $tenant = new Tenant([
        'company_name' => 'Fresh',
        'created_at' => now(),
    ]);

    expect(app(PersonaWorkspaceModeSwitchPolicy::class)->canShowModeSwitch($tenant))->toBeTrue();
});

it('blocks mode switch until workspace meets minimum age', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => PersonaWorkspaceModeSwitchPolicy::PLATFORM_SETTING_KEY],
        ['group' => 'persona', 'value' => '30', 'type' => 'integer', 'label' => 'test'],
    );

    $young = new Tenant(['created_at' => now()->subDays(5)]);
    $mature = new Tenant(['created_at' => now()->subDays(31)]);

    $policy = app(PersonaWorkspaceModeSwitchPolicy::class);

    expect($policy->minWorkspaceAgeDays())->toBe(30)
        ->and($policy->isRuleEnabled())->toBeTrue()
        ->and($policy->canShowModeSwitch($young))->toBeFalse()
        ->and($policy->canShowModeSwitch($mature))->toBeTrue();
});

it('prefers platform_settings over config default', function (): void {
    config(['persona_workspace.mode_switch_min_workspace_age_days' => 30]);

    PlatformSetting::query()->updateOrCreate(
        ['key' => PersonaWorkspaceModeSwitchPolicy::PLATFORM_SETTING_KEY],
        ['group' => 'persona', 'value' => '7', 'type' => 'integer', 'label' => 'test'],
    );

    $tenant = new Tenant(['created_at' => now()->subDays(10)]);

    expect(app(PersonaWorkspaceModeSwitchPolicy::class)->canShowModeSwitch($tenant))->toBeTrue();
});

it('treats workspace created exactly on boundary as eligible', function (): void {
    Carbon::setTestNow('2026-05-24 12:00:00');

    PlatformSetting::query()->updateOrCreate(
        ['key' => PersonaWorkspaceModeSwitchPolicy::PLATFORM_SETTING_KEY],
        ['group' => 'persona', 'value' => '30', 'type' => 'integer', 'label' => 'test'],
    );

    $tenant = new Tenant(['created_at' => now()->subDays(30)]);

    expect(app(PersonaWorkspaceModeSwitchPolicy::class)->canShowModeSwitch($tenant))->toBeTrue();

    Carbon::setTestNow();
});
