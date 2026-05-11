<?php

declare(strict_types=1);

use App\Http\Controllers\Central\Admin\SettingsController;
use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformSetting;
use App\Models\Central\PlatformUser;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

beforeEach(function (): void {
    FeatureFlag::syncFromCatalogue();
});

it('persists tavily settings from platform keys ai form', function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);

    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.platform-settings.index'))
        ->assertOk();

    $payload = [];
    foreach (PlatformSetting::query()->where('group', 'ai')->get() as $row) {
        if ($row->type === 'boolean') {
            $payload[$row->key] = $row->value === '1' ? '1' : '0';
        } else {
            $payload[$row->key] = $row->value;
        }
    }

    $payload['tavily_api_key'] = 'tvly-persist-test-key';
    $payload['carina_tavily_enabled'] = '1';
    $payload['carina_tavily_trigger'] = 'keywords';
    $payload['tavily_search_depth'] = 'advanced';
    $payload['tavily_max_results'] = '7';

    $this->actingAs($admin, 'platform')
        ->post(route('admin.platform-settings.update-group', 'ai'), $payload)
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $stored = PlatformSetting::query()->where('key', 'tavily_api_key')->value('value');
    expect($stored)->toBe('tvly-persist-test-key');
    expect(PlatformSetting::query()->where('key', 'carina_tavily_enabled')->value('value'))->toBe('1');
    expect(PlatformSetting::query()->where('key', 'tavily_search_depth')->value('value'))->toBe('advanced');
    expect(PlatformSetting::query()->where('key', 'tavily_max_results')->value('value'))->toBe('7');
});

it('persists PropertyData platform integrations settings from the integrations tab', function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);

    $admin = PlatformUser::factory()->superAdmin()->create();

    app(SettingsController::class)->bootstrap();

    $payload = [];
    foreach (PlatformSetting::query()->where('group', 'integrations')->get() as $row) {
        if ($row->type === 'boolean') {
            $payload[$row->key] = $row->value === '1' ? '1' : '0';
        } else {
            $payload[$row->key] = $row->value;
        }
    }

    $payload['propertydata_platform_api_key'] = 'pd-platform-test-key';
    $payload['propertydata_allow_tenant_byok'] = '0';

    $this->actingAs($admin, 'platform')
        ->post(route('admin.platform-settings.update-group', 'integrations'), $payload)
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect(PlatformSetting::query()->where('key', 'propertydata_platform_api_key')->value('value'))->toBe('pd-platform-test-key')
        ->and(PlatformSetting::query()->where('key', 'propertydata_allow_tenant_byok')->value('value'))->toBe('0');
});
