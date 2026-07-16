<?php

declare(strict_types=1);

use App\Models\Central\SettingDefinition;
use App\Services\Configuration\Contracts\SettingServiceInterface;
use Illuminate\Support\Facades\Cache;

it('invalidates cached resolution after global write', function () {
    Cache::flush();

    SettingDefinition::factory()->create([
        'key' => 'cache.probe',
        'default_value' => 'first',
        'type' => 'string',
        'category' => 'c',
        'validation_rules' => ['laravel' => ['string', 'max:32']],
    ]);

    $service = app(SettingServiceInterface::class);

    expect($service->getTenantSetting('', 'cache.probe'))->toBe('first');

    $service->set('cache.probe', 'second', null, null);

    expect($service->getTenantSetting('', 'cache.probe'))->toBe('second');
});

it('clearCache drops resolution for a key', function () {
    Cache::flush();

    SettingDefinition::factory()->create([
        'key' => 'cache.clear',
        'default_value' => 'def',
        'type' => 'string',
        'category' => 'c',
        'validation_rules' => ['laravel' => ['string', 'max:32']],
    ]);

    $service = app(SettingServiceInterface::class);
    $service->getTenantSetting('', 'cache.clear');

    SettingDefinition::where('key', 'cache.clear')->update(['default_value' => 'changed']);

    $service->clearCache(null, 'cache.clear');

    expect($service->getTenantSetting('', 'cache.clear'))->toBe('changed');
});

it('busts only the tenant cache entry when a tenant override changes', function () {
    Cache::flush();

    $tenant = createCentralTenant();

    SettingDefinition::factory()->create([
        'key' => 'cache.tenant',
        'default_value' => 'global-default',
        'type' => 'string',
        'category' => 'c',
        'validation_rules' => ['laravel' => ['string', 'max:40']],
    ]);

    $service = app(SettingServiceInterface::class);

    $service->set('cache.tenant', 'global-v', null, null);
    expect($service->getTenantSetting('', 'cache.tenant'))->toBe('global-v');
    expect($service->getTenantSetting($tenant->id, 'cache.tenant'))->toBe('global-v');

    $service->set('cache.tenant', 'tenant-v', $tenant->id, null);

    expect($service->getTenantSetting($tenant->id, 'cache.tenant'))->toBe('tenant-v')
        ->and($service->getTenantSetting('', 'cache.tenant'))->toBe('global-v');
});
