<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Models\Central\PlatformUser;
use App\Services\Persona\PersonaWorkspaceModeSwitchPolicy;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);

    PlatformSetting::query()
        ->where('key', PersonaWorkspaceModeSwitchPolicy::PLATFORM_SETTING_KEY)
        ->delete();
});

it('shows workspace persona rule on system settings not feature flags', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.settings.index'))
        ->assertOk()
        ->assertSee('Workspace personas')
        ->assertSee('Min. age (days)');

    $this->actingAs($admin, 'platform')
        ->get(route('admin.flags.index'))
        ->assertOk()
        ->assertDontSee('Minimum workspace age (days)')
        ->assertSee('Workspace mode rule');
});

it('saves minimum workspace age from system settings', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->put(route('admin.settings.persona-mode-switch.update'), [
            'mode_switch_min_workspace_age_days' => 30,
        ])
        ->assertRedirect(route('admin.settings.index').'#sec-workspace-persona')
        ->assertSessionHas('success');

    expect(PlatformSetting::get(PersonaWorkspaceModeSwitchPolicy::PLATFORM_SETTING_KEY))->toBe('30')
        ->and(app(PersonaWorkspaceModeSwitchPolicy::class)->minWorkspaceAgeDays())->toBe(30);
});

it('allows zero to disable the workspace age rule', function (): void {
    PlatformSetting::query()->updateOrCreate(
        ['key' => PersonaWorkspaceModeSwitchPolicy::PLATFORM_SETTING_KEY],
        ['group' => 'persona', 'value' => '30', 'type' => 'integer', 'label' => 'test'],
    );

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->put(route('admin.settings.persona-mode-switch.update'), [
            'mode_switch_min_workspace_age_days' => 0,
        ])
        ->assertRedirect(route('admin.settings.index').'#sec-workspace-persona');

    expect(app(PersonaWorkspaceModeSwitchPolicy::class)->minWorkspaceAgeDays())->toBe(0)
        ->and(app(PersonaWorkspaceModeSwitchPolicy::class)->isRuleEnabled())->toBeFalse();
});
