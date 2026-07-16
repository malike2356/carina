<?php

declare(strict_types=1);

use App\Models\Central\PlatformPermission;
use App\Models\Central\PlatformRole;
use App\Models\Central\PlatformUser;
use App\Models\Central\Setting;
use App\Models\Central\SettingDefinition;
use App\Services\Configuration\Contracts\SettingServiceInterface;

beforeEach(function () {
    foreach (['portal.banner', 'a.one', 'a.two', 'custom.key'] as $key) {
        Setting::on('central')->where('key', $key)->delete();
        SettingDefinition::on('central')->where('key', $key)->delete();
    }

    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('shows configuration index for super admin', function () {
    SettingDefinition::factory()->create([
        'key' => 'portal.banner',
        'category' => 'portal',
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.settings.index'))
        ->assertOk()
        ->assertSee('portal.banner');
});

it('updates a setting via PUT', function () {
    SettingDefinition::factory()->create([
        'key' => 'portal.banner',
        'default_value' => 'hello',
        'type' => 'string',
        'category' => 'portal',
        'validation_rules' => ['laravel' => ['string', 'max:255']],
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->put(route('admin.settings.update', ['key' => 'portal.banner']), [
            'value' => 'updated',
        ])
        ->assertRedirect();

    expect(app(SettingServiceInterface::class)->getTenantSetting('', 'portal.banner'))
        ->toBe('updated');
});

it('applies tenant scoped update when tenant_id provided', function () {
    $tenant = createCentralTenant([
        'slug' => 'ctrl-tenant',
        'company_name' => 'Ctrl Tenant Ltd',
        'owner_email' => 'owner@ctrl.test',
    ]);

    SettingDefinition::factory()->create([
        'key' => 'portal.banner',
        'default_value' => 'global',
        'type' => 'string',
        'category' => 'portal',
        'validation_rules' => ['laravel' => ['string', 'max:255']],
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->put(route('admin.settings.update', ['key' => 'portal.banner']), [
            'value' => 'tenant-specific',
            'tenant_id' => $tenant->id,
        ])
        ->assertRedirect();

    $svc = app(SettingServiceInterface::class);

    expect($svc->getTenantSetting('', 'portal.banner'))->toBe('global');
    expect($svc->getTenantSetting($tenant->id, 'portal.banner'))->toBe('tenant-specific');
});

it('runs bulk update', function () {
    SettingDefinition::factory()->create([
        'key' => 'a.one',
        'type' => 'string',
        'category' => 't',
        'validation_rules' => ['laravel' => ['string', 'max:10']],
    ]);
    SettingDefinition::factory()->create([
        'key' => 'a.two',
        'type' => 'string',
        'category' => 't',
        'validation_rules' => ['laravel' => ['string', 'max:10']],
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->post(route('admin.settings.bulk'), [
            'settings' => [
                ['key' => 'a.one', 'value' => 'x'],
                ['key' => 'a.two', 'value' => 'y'],
            ],
        ])
        ->assertRedirect();

    $svc = app(SettingServiceInterface::class);
    expect($svc->getTenantSetting('', 'a.one'))->toBe('x');
    expect($svc->getTenantSetting('', 'a.two'))->toBe('y');
});

it('creates a definition from admin UI', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->post(route('admin.setting-definitions.store'), [
            'key' => 'custom.key',
            'default_value' => 'dv',
            'type' => 'string',
            'category' => 'custom',
            'is_public' => false,
        ])
        ->assertRedirect();

    expect(SettingDefinition::query()->where('key', 'custom.key')->exists())->toBeTrue();
});

it('rejects platform users without typed settings permission', function () {
    $role = PlatformRole::query()->create([
        'name' => 'no_typed_settings_'.uniqid(),
        'guard_name' => 'platform',
    ]);
    $role->syncPermissions(
        PlatformPermission::query()->where('guard_name', 'platform')->where('name', 'manage-platform-users')->get()
    );

    $user = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_ADMIN]);
    $user->syncRoles([$role]);

    SettingDefinition::factory()->create(['key' => 'portal.banner']);

    $this->actingAs($user, 'platform')
        ->get(route('admin.settings.index'))
        ->assertForbidden();
});
