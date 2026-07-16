<?php

declare(strict_types=1);

use App\Models\Central\SettingAuditLog;
use App\Models\Central\SettingDefinition;
use App\Services\Configuration\Contracts\SettingServiceInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
});

it('resolves tenant override before global and definition default', function () {
    $tenant = createCentralTenant();

    SettingDefinition::factory()->create([
        'key' => 'mail.from.name',
        'default_value' => 'Default Co',
        'type' => 'string',
        'category' => 'mail',
        'validation_rules' => ['laravel' => ['string', 'max:255']],
    ]);

    $service = app(SettingServiceInterface::class);

    expect($service->getTenantSetting('', 'mail.from.name'))->toBe('Default Co');

    $service->set('mail.from.name', 'Global Name', null, null);
    expect($service->getTenantSetting('', 'mail.from.name'))->toBe('Global Name');
    expect($service->getTenantSetting($tenant->id, 'mail.from.name'))->toBe('Global Name');

    $service->set('mail.from.name', 'Tenant Name', $tenant->id, null);
    expect($service->getTenantSetting($tenant->id, 'mail.from.name'))->toBe('Tenant Name');
});

it('forget removes tenant row and falls back', function () {
    $tenant = createCentralTenant();

    SettingDefinition::factory()->create([
        'key' => 'ui.theme',
        'default_value' => 'light',
        'type' => 'string',
        'category' => 'ui',
        'validation_rules' => ['laravel' => ['string', 'max:32']],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->set('ui.theme', 'dark', null, null);
    $service->set('ui.theme', 'tenant-dark', $tenant->id, null);

    expect($service->getTenantSetting($tenant->id, 'ui.theme'))->toBe('tenant-dark');

    $service->forget('ui.theme', $tenant->id, null);

    expect($service->getTenantSetting($tenant->id, 'ui.theme'))->toBe('dark');
});

it('writes audit rows on set', function () {
    SettingDefinition::factory()->create([
        'key' => 'ops.flag',
        'default_value' => '0',
        'type' => 'boolean',
        'category' => 'ops',
        'validation_rules' => ['laravel' => []],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->set('ops.flag', true, null, null);

    expect(SettingAuditLog::query()->where('setting_key', 'ops.flag')->where('action', 'set')->count())->toBe(1);
});

it('casts boolean and integer types', function () {
    SettingDefinition::factory()->create([
        'key' => 'feat.enabled',
        'default_value' => null,
        'type' => 'boolean',
        'category' => 'feat',
        'validation_rules' => ['laravel' => []],
    ]);

    SettingDefinition::factory()->create([
        'key' => 'feat.limit',
        'default_value' => null,
        'type' => 'integer',
        'category' => 'feat',
        'validation_rules' => ['laravel' => ['integer', 'min:1']],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->set('feat.enabled', '1', null, null);
    $service->set('feat.limit', '42', null, null);

    expect($service->getTenantSetting('', 'feat.enabled'))->toBeTrue();
    expect($service->getTenantSetting('', 'feat.limit'))->toBe(42);
});

it('returns the passed default when no definition exists', function () {
    $service = app(SettingServiceInterface::class);

    expect($service->getTenantSetting('', 'no.such.definition', 'fallback'))->toBe('fallback');
});

it('returns getCategory and getAll shaped arrays', function () {
    SettingDefinition::factory()->create([
        'key' => 'cat.a',
        'default_value' => '1',
        'type' => 'string',
        'category' => 'alpha',
        'validation_rules' => ['laravel' => []],
    ]);
    SettingDefinition::factory()->create([
        'key' => 'cat.b',
        'default_value' => '2',
        'type' => 'string',
        'category' => 'beta',
        'validation_rules' => ['laravel' => []],
    ]);

    $service = app(SettingServiceInterface::class);
    $cat = $service->getCategory('alpha', null);

    expect($cat)->toHaveKey('cat.a')
        ->and($cat)->not->toHaveKey('cat.b');

    $all = $service->getAll(null);
    expect($all)->toHaveKeys(['cat.a', 'cat.b']);
});

it('round-trips json type values', function () {
    SettingDefinition::factory()->create([
        'key' => 'payload.meta',
        'default_value' => null,
        'type' => 'json',
        'category' => 'api',
        'validation_rules' => ['laravel' => ['json']],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->set('payload.meta', ['a' => 1, 'b' => ['c' => true]], null, null);

    expect($service->getTenantSetting('', 'payload.meta'))->toBe(['a' => 1, 'b' => ['c' => true]]);
});

it('stores and reads float type', function () {
    SettingDefinition::factory()->create([
        'key' => 'rate.apr',
        'default_value' => null,
        'type' => 'float',
        'category' => 'finance',
        'validation_rules' => ['laravel' => ['numeric']],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->set('rate.apr', '3.25', null, null);

    expect($service->getTenantSetting('', 'rate.apr'))->toBe(3.25);
});

it('isolates values between two tenants', function () {
    $t1 = createCentralTenant(['slug' => 'iso-one']);
    $t2 = createCentralTenant(['slug' => 'iso-two']);

    SettingDefinition::factory()->create([
        'key' => 'iso.key',
        'type' => 'string',
        'category' => 'q',
        'default_value' => 'base',
        'validation_rules' => ['laravel' => ['string', 'max:20']],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->set('iso.key', 'one', $t1->id, null);
    $service->set('iso.key', 'two', $t2->id, null);

    expect($service->getTenantSetting($t1->id, 'iso.key'))->toBe('one')
        ->and($service->getTenantSetting($t2->id, 'iso.key'))->toBe('two');
});

it('records forget in the audit log', function () {
    SettingDefinition::factory()->create([
        'key' => 'tmp.flag',
        'type' => 'string',
        'category' => 'q',
        'default_value' => 'x',
        'validation_rules' => ['laravel' => []],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->set('tmp.flag', 'y', null, null);
    $service->forget('tmp.flag', null, null);

    expect(SettingAuditLog::query()->where('setting_key', 'tmp.flag')->where('action', 'forget')->count())->toBe(1);
});

it('throws when set value violates validation rules', function () {
    SettingDefinition::factory()->create([
        'key' => 'strict.len',
        'type' => 'string',
        'category' => 'q',
        'default_value' => 'ok',
        'validation_rules' => ['laravel' => ['string', 'max:3']],
    ]);

    $service = app(SettingServiceInterface::class);

    expect(fn () => $service->set('strict.len', 'nope', null, null))
        ->toThrow(ValidationException::class);
});
