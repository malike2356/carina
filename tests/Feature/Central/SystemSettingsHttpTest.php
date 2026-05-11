<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;
use App\Models\Central\Setting;
use App\Models\Central\SettingDefinition;
use App\Services\Configuration\Contracts\SettingServiceInterface;

beforeEach(function () {
    foreach ([
        'acme.widget', 'acme.short', 'bulk.a', 'bulk.b', 'dup.key', 'sync.key', 'gone.key', 'x.y', 'scoped.key',
    ] as $key) {
        Setting::on('central')->where('key', $key)->delete();
        SettingDefinition::on('central')->where('key', $key)->delete();
    }

    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('redirects guests from system settings to central login', function () {
    $this->get(route('admin.settings.index'))
        ->assertRedirect(route('central.login'));
});

it('redirects guests from setting definitions to central login', function () {
    $this->get(route('admin.setting-definitions.index'))
        ->assertRedirect(route('central.login'));
});

it('allows platform admins with definition access to setting definitions index', function () {
    $user = PlatformUser::factory()->admin()->create();

    $this->actingAs($user, 'platform')
        ->get(route('admin.setting-definitions.index'))
        ->assertOk();
});

it('returns forbidden for platform support users on setting definitions without typed settings grants', function () {
    $user = PlatformUser::factory()->create(['role' => PlatformUser::ROLE_SUPPORT]);

    $this->actingAs($user, 'platform')
        ->get(route('admin.setting-definitions.index'))
        ->assertForbidden();
});

it('returns 404 when showing a key with no definition', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.settings.show', ['key' => 'missing.key']))
        ->assertNotFound();
});

it('renders the show page for a defined key', function () {
    SettingDefinition::factory()->create([
        'key' => 'acme.widget',
        'default_value' => 'alpha',
        'type' => 'string',
        'category' => 'acme',
        'validation_rules' => ['laravel' => ['string', 'max:100']],
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.settings.show', ['key' => 'acme.widget']))
        ->assertOk()
        ->assertSee('acme.widget', false)
        ->assertSee('alpha', false);
});

it('rejects PUT when tenant_id does not exist', function () {
    SettingDefinition::factory()->create([
        'key' => 'acme.widget',
        'default_value' => 'x',
        'type' => 'string',
        'category' => 'acme',
        'validation_rules' => ['laravel' => ['string', 'max:100']],
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->from(route('admin.settings.show', ['key' => 'acme.widget']))
        ->put(route('admin.settings.update', ['key' => 'acme.widget']), [
            'value' => 'y',
            'tenant_id' => '00000000-0000-0000-0000-000000000000',
        ])
        ->assertSessionHasErrors('tenant_id');
});

it('rejects PUT when value fails definition validation rules', function () {
    SettingDefinition::factory()->create([
        'key' => 'acme.short',
        'default_value' => 'ab',
        'type' => 'string',
        'category' => 'acme',
        'validation_rules' => ['laravel' => ['string', 'max:5']],
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->from(route('admin.settings.show', ['key' => 'acme.short']))
        ->put(route('admin.settings.update', ['key' => 'acme.short']), [
            'value' => 'too-long-value',
        ])
        ->assertSessionHasErrors('value');
});

it('rejects bulk update when a row fails validation', function () {
    SettingDefinition::factory()->create([
        'key' => 'bulk.a',
        'type' => 'string',
        'category' => 'b',
        'validation_rules' => ['laravel' => ['string', 'max:2']],
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->from(route('admin.settings.index'))
        ->post(route('admin.settings.bulk'), [
            'settings' => [
                ['key' => 'bulk.a', 'value' => 'abc'],
            ],
        ])
        ->assertSessionHasErrors('settings.0.value');
});

it('rejects bulk update when settings payload is empty', function () {
    SettingDefinition::factory()->create(['key' => 'bulk.b', 'type' => 'string', 'category' => 'b']);

    $this->actingAs($this->superAdmin, 'platform')
        ->from(route('admin.settings.index'))
        ->post(route('admin.settings.bulk'), [
            'settings' => [],
        ])
        ->assertSessionHasErrors('settings');
});

it('rejects duplicate definition keys on store', function () {
    SettingDefinition::factory()->create([
        'key' => 'dup.key',
        'type' => 'string',
        'category' => 'c',
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->from(route('admin.setting-definitions.index'))
        ->post(route('admin.setting-definitions.store'), [
            'key' => 'dup.key',
            'type' => 'string',
            'category' => 'c',
            'is_public' => false,
        ])
        ->assertSessionHasErrors('key');
});

it('updates a definition and syncs type on existing setting rows', function () {
    $def = SettingDefinition::factory()->create([
        'key' => 'sync.key',
        'type' => 'string',
        'category' => 'oldcat',
        'default_value' => 'v',
        'validation_rules' => ['laravel' => ['string', 'max:50']],
    ]);

    app(SettingServiceInterface::class)->set('sync.key', 'stored', null, $this->superAdmin->id);

    $this->actingAs($this->superAdmin, 'platform')
        ->from(route('admin.setting-definitions.index'))
        ->put(route('admin.setting-definitions.update', $def), [
            'type' => 'string',
            'category' => 'newcat',
            'default_value' => 'v2',
            'is_public' => true,
        ])
        ->assertRedirect();

    $def->refresh();
    expect($def->category)->toBe('newcat')
        ->and($def->is_public)->toBeTrue();

    expect(Setting::query()->where('key', 'sync.key')->value('category'))->toBe('newcat');
});

it('deletes a definition and removes stored values', function () {
    $def = SettingDefinition::factory()->create([
        'key' => 'gone.key',
        'type' => 'string',
        'category' => 'z',
    ]);

    app(SettingServiceInterface::class)->set('gone.key', 'data', null, $this->superAdmin->id);
    expect(Setting::query()->where('key', 'gone.key')->count())->toBe(1);

    $this->actingAs($this->superAdmin, 'platform')
        ->delete(route('admin.setting-definitions.destroy', $def))
        ->assertRedirect();

    expect(SettingDefinition::query()->where('key', 'gone.key')->exists())->toBeFalse()
        ->and(Setting::query()->where('key', 'gone.key')->count())->toBe(0);
});

it('allows super admin to open legacy platform settings and ai providers pages', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.platform-settings.index'))
        ->assertOk();

    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.platform-settings.ai-providers'))
        ->assertOk();
});

it('lists tenants on the settings index for workspace override', function () {
    $t = createCentralTenant(['slug' => 'ws-alpha', 'company_name' => 'Alpha Workspace']);

    SettingDefinition::factory()->create(['key' => 'x.y', 'category' => 'c']);

    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.settings.index'))
        ->assertOk()
        ->assertSee('ws-alpha', false)
        ->assertSee('Alpha Workspace', false);
});

it('filters effective values when tenant_id query is present', function () {
    $tenant = createCentralTenant(['slug' => 'scoped-z']);

    SettingDefinition::factory()->create([
        'key' => 'scoped.key',
        'default_value' => 'def',
        'type' => 'string',
        'category' => 'c',
        'validation_rules' => ['laravel' => ['string', 'max:20']],
    ]);

    app(SettingServiceInterface::class)->set('scoped.key', 'global-val', null, $this->superAdmin->id);
    app(SettingServiceInterface::class)->set('scoped.key', 'tenant-val', $tenant->id, $this->superAdmin->id);

    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.settings.index', ['tenant_id' => $tenant->id]))
        ->assertOk()
        ->assertSee('tenant-val', false);
});
